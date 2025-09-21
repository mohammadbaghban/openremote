import {WidgetConfig} from "../util/widget-config";
import {AssetModelUtil, Attribute, AttributeRef, WellknownValueTypes} from "@openremote/model";
import {OrWidget, WidgetManifest} from "../util/or-widget";
import { customElement } from "lit/decorators.js";
import {WidgetSettings} from "../util/widget-settings";
import {css, CSSResult, html, PropertyValues, TemplateResult, unsafeCSS } from "lit";
import {OrAssetWidget} from "../util/or-asset-widget";
import {ImageSettings} from "../settings/image-settings";
import { when } from "lit/directives/when.js";
import manager, {DefaultColor2, DefaultColor3, Util} from "@openremote/core";
import { styleMap } from "lit/directives/style-map.js";
import { repeat } from "lit/directives/repeat.js";

const styling = css`
  #img-wrapper {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    z-index: 1;
  }

  #img-container {
    position: relative;
    max-height: 100%;
  }

  #img-content {
    height: 100%;
    max-height: 100%;
    max-width: 100%;
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

export interface ImageAssetMarker {
    attributeRef: AttributeRef,
    coordinates: [number, number]
}

export interface ImageWidgetConfig extends WidgetConfig {
    attributeRefs: AttributeRef[];
    markers: ImageAssetMarker[];
    showTimestampControls: boolean;
    imagePath: string;
    // Optional: bind image URL to a string attribute; if set, this overrides imagePath
    imageUrlAttributeRef?: AttributeRef;
}

function getDefaultWidgetConfig(): ImageWidgetConfig {
    return {
        attributeRefs: [],
        showTimestampControls: false,
        imagePath: '',
        markers: [],
    };
}

@customElement("image-widget")
export class ImageWidget extends OrAssetWidget {

    // Override of widgetConfig with extended type
    protected readonly widgetConfig!: ImageWidgetConfig;

    // Live update subscription id
    protected _attributeSubscriptionId?: string;

    // Version bump to force <img> reload when attribute changes but URL string stays the same
    protected _imageVersion: number = 0;

    protected getAllAttributeRefs(): AttributeRef[] {
        const attributeRefs = this.widgetConfig?.attributeRefs || [];
        return this.widgetConfig?.imageUrlAttributeRef ? [...attributeRefs, this.widgetConfig.imageUrlAttributeRef] : attributeRefs;
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
                console.log("ImageWidget: No event provider available so cannot subscribe");
                return;
            }
            // Request current values so initial state is pushed via events as well
            this._attributeSubscriptionId = await events.subscribeAttributeEvents(refs, true, (event) => {
                const ref = event.ref!;
                // Update cached asset/attribute on event
                const idx = this.loadedAssets.findIndex(a => a.id === ref.id);
                if (idx >= 0) {
                    // Shallow clone and update via Util.updateAsset helper for consistency
                    const copy = {...this.loadedAssets[idx]};
                    const updated = Util.updateAsset(copy as any, event as any);
                    const nextAssets = [...this.loadedAssets];
                    nextAssets[idx] = updated as any;
                    this.loadedAssets = nextAssets;
                }
                // If the event pertains to the image URL attribute, bump version for cache-busting
                const imgRef = this.widgetConfig?.imageUrlAttributeRef;
                if (imgRef && ref.id === imgRef.id && ref.name === imgRef.name) {
                    this._imageVersion++;
                }
                // Trigger render update
                this.requestUpdate();
            });
        } catch (e) {
            // Non-fatal; widget will still show last fetched state
            console.warn("ImageWidget: failed to subscribe attribute events", e);
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
            displayName: "Image",
            displayIcon: "file-image-marker",
            minColumnWidth: 1,
            minColumnHeight: 1,
            getContentHtml(config: ImageWidgetConfig): OrWidget {
                return new ImageWidget(config);
            },
            getSettingsHtml(config: ImageWidgetConfig): WidgetSettings {
                return new ImageSettings(config);
            },
            getDefaultConfig(): ImageWidgetConfig {
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
            const prevConfig = changedProps.get('widgetConfig') as ImageWidgetConfig | undefined;

            const attributeRefs = this.widgetConfig.attributeRefs || [];
            const allRefs: AttributeRef[] = this.widgetConfig.imageUrlAttributeRef ? [...attributeRefs, this.widgetConfig.imageUrlAttributeRef] : attributeRefs;
            const missingAssets = allRefs?.filter((attrRef: AttributeRef) => !this.isAttributeRefLoaded(attrRef));
            if (missingAssets.length > 0) {
                this.loadAssets();
            }
            // If static imagePath changed, bump version to force reload
            if (prevConfig && prevConfig.imagePath !== this.widgetConfig.imagePath) {
                this._imageVersion++;
            }
            // Refresh live subscriptions if config changed
            this._unsubscribeAttributeEvents();
            this._subscribeAttributeEvents();
        }

        return super.willUpdate(changedProps);
    }

    protected loadAssets() {
        const attributeRefs = this.widgetConfig.attributeRefs || [];
        const allRefs: AttributeRef[] = this.widgetConfig.imageUrlAttributeRef ? [...attributeRefs, this.widgetConfig.imageUrlAttributeRef] : attributeRefs;
        this.fetchAssets(allRefs).then(assets => {
            this.loadedAssets = assets!;
            this.assetAttributes = attributeRefs.map((attrRef: AttributeRef) => {
                const assetIndex = assets!.findIndex(asset => asset.id === attrRef.id);
                const foundAsset = assetIndex >= 0 ? assets![assetIndex] : undefined;
                return foundAsset && foundAsset.attributes ? [assetIndex, foundAsset.attributes[attrRef.name!]] : undefined;
            }).filter((indexAndAttr: any) => !!indexAndAttr) as [number, Attribute<any>][];
        });
    }

    // method to render and update the markers on the image
    protected handleMarkerPlacement(config: ImageWidgetConfig) {
        if (this.assetAttributes.length && config.attributeRefs.length > 0) {

            if(config.markers.length === 0) {
                console.error("No markers found!");
                return [];
            }
            return config.attributeRefs.map((attributeRef, index) => {
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

    protected getImagePathFromAttribute(): string | undefined {
        const imgRef = this.widgetConfig.imageUrlAttributeRef;
        if (!imgRef || !this.loadedAssets || this.loadedAssets.length === 0) {
            return undefined;
        }
        const asset = this.loadedAssets.find(a => a.id === imgRef.id);
        if (!asset || !asset.attributes) {
            return undefined;
        }
        const attribute = asset.attributes[imgRef.name!];
        if (!attribute) {
            return undefined;
        }
        const descriptors = AssetModelUtil.getAttributeAndValueDescriptors(asset.type, imgRef.name, attribute);
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
        const attrPath = this.getImagePathFromAttribute();
        const rawPath = attrPath ?? this.widgetConfig.imagePath;
        const imagePath = this._withCacheBust(rawPath, this._imageVersion);
        return html`
            <div id="img-wrapper">
                ${when(imagePath, () => html`
                    <div id="img-container">
                        ${repeat([imagePath], (key) => key, () => html`
                            <img id="img-content" src="${imagePath}" alt=""/>
                        `)}
                        <div>
                            ${this.handleMarkerPlacement(this.widgetConfig)}
                        </div>
                    </div>
                `, () => html`
                    <span><or-translate value="dashboard.noImageSelected"></or-translate></span>
                `)}
            </div>
        `;
    }

}
