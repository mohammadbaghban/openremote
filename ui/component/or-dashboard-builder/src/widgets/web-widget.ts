import {WidgetConfig} from "../util/widget-config";
import {AssetModelUtil, Attribute, AttributeRef, WellknownValueTypes} from "@openremote/model";
import {OrWidget, WidgetManifest} from "../util/or-widget";
import { customElement } from "lit/decorators.js";
import {WidgetSettings} from "../util/widget-settings";
import {css, CSSResult, html, PropertyValues, TemplateResult, unsafeCSS } from "lit";
import {OrAssetWidget} from "../util/or-asset-widget";
import { when } from "lit/directives/when.js";
import manager, {DefaultColor2, DefaultColor3, Util} from "@openremote/core";
import { styleMap } from "lit/directives/style-map.js";
import { repeat } from "lit/directives/repeat.js";
import { WebSettings } from "../settings/web-settings";

const styling = css`
  #web-wrapper {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    z-index: 1;
  }

  #web-container {
    position: relative;
    max-height: 100%;
    height: 100%;
    width: 100%;
  }

  #web-content {
    height: 100%;
    width: 100%;
    max-height: 100%;
    max-width: 100%;
    border: none;
  }

  #overlay {
    position: absolute;
    z-index: 3;

    /* additional marker styling */
    color: var(--or-app-color2, ${unsafeCSS(DefaultColor2)});
    background-color: var(--or-app-color3, ${unsafeCSS(DefaultColor3)});
    border-radius: 15px;
    padding: 3px 8px 5px 8px;
    object-fit: contain;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export interface WebAssetMarker {
    attributeRef: AttributeRef,
    coordinates: [number, number]
}

export interface WebWidgetConfig extends WidgetConfig {
    attributeRefs: AttributeRef[];
    markers: WebAssetMarker[];
    showTimestampControls: boolean;
    pagePath: string;
    // Optional: bind page URL to a string attribute; if set, this overrides pagePath
    pageUrlAttributeRef?: AttributeRef;
}

function getDefaultWidgetConfig(): WebWidgetConfig {
    return {
        attributeRefs: [],
        showTimestampControls: false,
        pagePath: '',
        markers: [],
    };
}

@customElement("web-widget")
export class WebWidget extends OrAssetWidget {

    protected readonly widgetConfig!: WebWidgetConfig;

    protected _attributeSubscriptionId?: string;

    protected _pageVersion: number = 0;

    protected getAllAttributeRefs(): AttributeRef[] {
        const attributeRefs = this.widgetConfig?.attributeRefs || [];
        return this.widgetConfig?.pageUrlAttributeRef ? [...attributeRefs, this.widgetConfig.pageUrlAttributeRef] : attributeRefs;
    }

    connectedCallback() {
        super.connectedCallback?.();
        this._subscribeAttributeEvents();
    }

    disconnectedCallback() {
        this._unsubscribeAttributeEvents();
        super.disconnectedCallback?.();
    }

    protected async _subscribeAttributeEvents() {
        try {
            const refs = this.getAllAttributeRefs();
            if (!refs || refs.length === 0) {
                return;
            }
            const events = manager.events;
            if (!events) {
                console.log("WebWidget: No event provider available so cannot subscribe");
                return;
            }
            this._attributeSubscriptionId = await events.subscribeAttributeEvents(refs, true, (event) => {
                const ref = event.ref!;
                const idx = this.loadedAssets.findIndex(a => a.id === ref.id);
                if (idx >= 0) {
                    const copy = {...this.loadedAssets[idx]};
                    const updated = Util.updateAsset(copy as any, event as any);
                    const nextAssets = [...this.loadedAssets];
                    nextAssets[idx] = updated as any;
                    this.loadedAssets = nextAssets;
                }
                const pageRef = this.widgetConfig?.pageUrlAttributeRef;
                if (pageRef && ref.id === pageRef.id && ref.name === pageRef.name) {
                    this._pageVersion++;
                }
                this.requestUpdate();
            });
        } catch (e) {
            console.warn("WebWidget: failed to subscribe attribute events", e);
        }
    }

    protected _unsubscribeAttributeEvents() {
        if (this._attributeSubscriptionId) {
            manager.events?.unsubscribe(this._attributeSubscriptionId);
            this._attributeSubscriptionId = undefined;
        }
    }

    static getManifest(): WidgetManifest {
        return {
            displayName: "Web page",
            displayIcon: "web",
            minColumnWidth: 1,
            minColumnHeight: 1,
            getContentHtml(config: WebWidgetConfig): OrWidget {
                return new WebWidget(config);
            },
            getSettingsHtml(config: WebWidgetConfig): WidgetSettings {
                return new WebSettings(config);
            },
            getDefaultConfig(): WebWidgetConfig {
                return getDefaultWidgetConfig();
            }
        }
    }

    public refreshContent(force: boolean) {
        this.loadAssets();
    }

    static get styles(): CSSResult[] {
        return [...super.styles, styling];
    }

    willUpdate(changedProps: PropertyValues) {
        if(changedProps.has('widgetConfig') && this.widgetConfig) {
            const prevConfig = changedProps.get('widgetConfig') as WebWidgetConfig | undefined;

            const attributeRefs = this.widgetConfig.attributeRefs || [];
            const allRefs: AttributeRef[] = this.widgetConfig.pageUrlAttributeRef ? [...attributeRefs, this.widgetConfig.pageUrlAttributeRef] : attributeRefs;
            const missingAssets = allRefs?.filter((attrRef: AttributeRef) => !this.isAttributeRefLoaded(attrRef));
            if (missingAssets.length > 0) {
                this.loadAssets();
            }
            if (prevConfig && prevConfig.pagePath !== this.widgetConfig.pagePath) {
                this._pageVersion++;
            }
            this._unsubscribeAttributeEvents();
            this._subscribeAttributeEvents();
        }

        return super.willUpdate(changedProps);
    }

    protected loadAssets() {
        const attributeRefs = this.widgetConfig.attributeRefs || [];
        const allRefs: AttributeRef[] = this.widgetConfig.pageUrlAttributeRef ? [...attributeRefs, this.widgetConfig.pageUrlAttributeRef] : attributeRefs;
        this.fetchAssets(allRefs).then(assets => {
            this.loadedAssets = assets!;
            this.assetAttributes = attributeRefs.map((attrRef: AttributeRef) => {
                const assetIndex = assets!.findIndex(asset => asset.id === attrRef.id);
                const foundAsset = assetIndex >= 0 ? assets![assetIndex] : undefined;
                return foundAsset && foundAsset.attributes ? [assetIndex, foundAsset.attributes[attrRef.name!]] : undefined;
            }).filter((indexAndAttr: any) => !!indexAndAttr) as [number, Attribute<any>][];
        });
    }

    protected handleMarkerPlacement(config: WebWidgetConfig) {
        if (this.assetAttributes.length && config.attributeRefs.length > 0) {
            if(config.markers.length === 0) {
                console.error("No markers found!");
                return [];
            }
            return config.attributeRefs.map((attributeRef, _index) => {
                const marker = config.markers.find(m => m.attributeRef.id === attributeRef.id && m.attributeRef.name === attributeRef.name);
                const asset = this.loadedAssets.find(a => a.id === attributeRef.id);
                let value: string | undefined;
                const styles: any = {
                    "left": `${marker!.coordinates[0]}%`,
                    "top": `${marker!.coordinates[1]}%`
                };
                if(asset) {
                    const attribute = asset.attributes![attributeRef.name!];
                    const descriptors = AssetModelUtil.getAttributeAndValueDescriptors(asset.type, attributeRef.name, attribute);
                    value = Util.getAttributeValueAsString(attribute, descriptors[0], asset.type, true, "-");
                    if(attribute?.type === WellknownValueTypes.COLOURRGB && value !== "-") {
                        styles.backgroundColor = value;
                        styles.minHeight = "21px";
                        styles.minWidth = "13px";
                        value = undefined;
                    }
                }
                return html`
                    <span id="overlay" style="${styleMap(styles)}">
                        ${value}
                    </span>
                `;
            });
        }
    }

    protected getPagePathFromAttribute(): string | undefined {
        const pageRef = this.widgetConfig.pageUrlAttributeRef;
        if (!pageRef || !this.loadedAssets || this.loadedAssets.length === 0) {
            return undefined;
        }
        const asset = this.loadedAssets.find(a => a.id === pageRef.id);
        if (!asset || !asset.attributes) {
            return undefined;
        }
        const attribute = asset.attributes[pageRef.name!];
        if (!attribute) {
            return undefined;
        }
        const descriptors = AssetModelUtil.getAttributeAndValueDescriptors(asset.type, pageRef.name, attribute);
        const value = Util.getAttributeValueAsString(attribute, descriptors[0], asset.type, true, "-");
        if (!value || value === "-") {
            return undefined;
        }
        return value;
    }

    protected _withCacheBust(url: string | undefined, version: number): string | undefined {
        if (!url) return url;
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}v=${version}`;
    }

    protected render(): TemplateResult {
        const attrPath = this.getPagePathFromAttribute();
        const rawPath = attrPath ?? this.widgetConfig.pagePath;
        const pagePath = this._withCacheBust(rawPath, this._pageVersion);
        return html`
            <div id="web-wrapper">
                ${when(pagePath, () => html`
                    <div id="web-container">
                        ${repeat([pagePath], (key) => key, () => html`
                            <iframe id="web-content" src="${pagePath}"></iframe>
                        `)}
                        <div>
                            ${this.handleMarkerPlacement(this.widgetConfig)}
                        </div>
                    </div>
                `, () => html`
                    <span><or-translate value="dashboard.noWebSelected"></or-translate></span>
                `)}
            </div>
        `;
    }

}
