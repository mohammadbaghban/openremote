import {css, html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import {WidgetSettings} from "../util/widget-settings";
import "../panels/attributes-panel";
import "../util/settings-panel";
import {i18next} from "@openremote/or-translate";
import {AttributeAction, AttributeActionEvent, AttributesSelectEvent} from "../panels/attributes-panel";
import {Asset, AssetDatapointIntervalQuery, AssetDatapointIntervalQueryFormula, Attribute, AttributeRef} from "@openremote/model";
import {ChartWidgetConfig} from "../widgets/chart-widget";
import {InputType, OrInputChangedEvent} from "@openremote/or-mwc-components/or-mwc-input";
import {TimePresetCallback} from "@openremote/or-chart";
import {when} from "lit/directives/when.js";

const styling = css`
  .switch-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
`


@customElement("chart-settings")
export class ChartSettings extends WidgetSettings {

    protected readonly widgetConfig!: ChartWidgetConfig

    protected timePresetOptions: Map<string, TimePresetCallback> = new Map<string, TimePresetCallback>();
    protected samplingOptions: Map<string, string> = new Map<string, string>();

    public setTimePresetOptions(options: Map<string, TimePresetCallback>) {
        this.timePresetOptions = options;
    }

    public setSamplingOptions(options: Map<string, string>) {
        this.samplingOptions = options;
    }

    static get styles() {
        return [...super.styles, styling];
    }

    protected render(): TemplateResult {
        const attributeFilter: (attr: Attribute<any>) => boolean = (attr): boolean => {
            return ["boolean", "positiveInteger", "positiveNumber", "number", "long", "integer", "bigInteger", "negativeInteger", "negativeNumber", "bigNumber", "integerByte", "direction"].includes(attr.type!)
        };
        const min = this.widgetConfig.chartOptions.options?.scales?.y?.min;
        const max = this.widgetConfig.chartOptions.options?.scales?.y?.max;
        const isMultiAxis = this.widgetConfig.rightAxisAttributes.length > 0;
        const samplingValue = Array.from(this.samplingOptions.entries()).find((entry => entry[1] === this.widgetConfig.datapointQuery.type))![0]
        const attributeLabelCallback = (asset: Asset, attribute: Attribute<any>, attributeLabel: string) => {
            const isOnRightAxis = isMultiAxis && this.widgetConfig.rightAxisAttributes.find(ar => ar.id === asset.id && ar.name === attribute.name) !== undefined;
            return html`
                <span>${asset.name}</span>
                <span style="font-size:14px; color:grey;">${attributeLabel}</span>
                ${when(isOnRightAxis, () => html`
                    <span style="position: absolute; right: 0; margin-bottom: 16px; font-size:14px; color:grey;"><or-translate value="right"></or-translate></span>
                `)}
            `
        }
        const attributeActionCallback = (attributeRef: AttributeRef): AttributeAction[] => {
            return [{
                icon: this.widgetConfig.rightAxisAttributes.includes(attributeRef) ? "arrow-right-bold" : "arrow-left-bold",
                tooltip: i18next.t('dashboard.toggleAxis'),
                disabled: false
            }]
        }
        return html`
            <div>
                <!-- Attribute selection -->
                <settings-panel displayName="attributes" expanded="${true}">
                    <attributes-panel .attributeRefs="${this.widgetConfig.attributeRefs}" multi="${true}" onlyDataAttrs="${true}" .attributeFilter="${attributeFilter}" style="padding-bottom: 12px;"
                                      .attributeLabelCallback="${attributeLabelCallback}" .attributeActionCallback="${attributeActionCallback}"
                                      @attribute-action="${(ev: AttributeActionEvent) => this.onAttributeAction(ev)}"
                                      @attribute-select="${(ev: AttributesSelectEvent) => this.onAttributesSelect(ev)}"
                    ></attributes-panel>
                </settings-panel>

                <!-- Display options -->
                <settings-panel displayName="display" expanded="${true}">
                    <div style="padding-bottom: 12px; display: flex; flex-direction: column; gap: 6px;">
                        <!-- Timeframe -->
                        <div>
                            <or-mwc-input .type="${InputType.SELECT}" label="${i18next.t('timeframeDefault')}" style="width: 100%;"
                                          .options="${Array.from(this.timePresetOptions.keys())}" value="${this.widgetConfig.defaultTimePresetKey}"
                                          @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onTimePresetSelect(ev)}"
                            ></or-mwc-input>
                        </div>
                        <!-- Y Min/max options -->
                        <div>
                            <div class="switch-container">
                                <span><or-translate value="dashboard.allowTimerangeSelect"></or-translate></span>
                                <or-mwc-input .type="${InputType.SWITCH}" style="margin: 0 -10px;" .value="${!this.widgetConfig.showTimestampControls}"
                                              @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onTimestampControlsToggle(ev)}"
                                ></or-mwc-input>
                            </div>
                            <div class="switch-container">
                                <span><or-translate value="dashboard.showLegend"></or-translate></span>
                                <or-mwc-input .type="${InputType.SWITCH}" style="margin: 0 -10px;" .value="${this.widgetConfig.showLegend}"
                                              @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onShowLegendToggle(ev)}"
                                ></or-mwc-input>
                            </div>
                            <div class="switch-container">
                                <span>Show grid</span>
                                <or-mwc-input .type="${InputType.SWITCH}" style="margin: 0 -10px;" .value="${this.widgetConfig.showGrid ?? false}"
                                              @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onShowGridToggle(ev)}"
                                ></or-mwc-input>
                            </div>
                            ${when(this.widgetConfig.showGrid, () => html`
                                <div style="display:flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                                    <div style="display:flex; gap: 12px;">
                                        <or-mwc-input .type="${InputType.NUMBER}" label="Grid X intensity (0-1)" .value="${this.widgetConfig.gridXIntensity ?? 0.2}"
                                                      min="0" max="1" step="0.05" style="width: 100%;"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onGridIntensityChange('x', ev)}"
                                        ></or-mwc-input>
                                        <or-mwc-input .type="${InputType.NUMBER}" label="Grid Y intensity (0-1)" .value="${this.widgetConfig.gridYIntensity ?? 0.2}"
                                                      min="0" max="1" step="0.05" style="width: 100%;"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onGridIntensityChange('y', ev)}"
                                        ></or-mwc-input>
                                    </div>
                                    <div style="display:flex; gap: 12px;">
                                        <or-mwc-input .type="${InputType.NUMBER}" label="Grid X density (any number)" .value="${this.widgetConfig.gridXDensity ?? 10}"
                                                      step="0.1" style="width: 100%;"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onGridDensityChange('x', ev)}"
                                        ></or-mwc-input>
                                        <or-mwc-input .type="${InputType.NUMBER}" label="Grid Y density (any number)" .value="${this.widgetConfig.gridYDensity ?? 10}"
                                                      step="0.1" style="width: 100%;"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onGridDensityChange('y', ev)}"
                                        ></or-mwc-input>
                                    </div>
                                    <div style="display:flex; gap: 12px;">
                                        <or-mwc-input .type="${InputType.SELECT}" label="X axis tick unit" style="width: 100%;"
                                                      .options="${['millisecond','second','minute','hour']}"
                                                      .value="${this.widgetConfig.chartOptions?.options?.scales?.x?.time?.unit ?? 'second'}"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onXAxisUnitChange(ev)}"
                                        ></or-mwc-input>
                                        <or-mwc-input .type="${InputType.NUMBER}" label="X axis step size" style="width: 100%;"
                                                      step="1" min="1"
                                                      .value="${this.widgetConfig.chartOptions?.options?.scales?.x?.time?.stepSize ?? 1}"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onXAxisStepSizeChange(ev)}"
                                        ></or-mwc-input>
                                    </div>
                                </div>
                            `)}
                        </div>
                    </div>
                </settings-panel>

                <!-- Axis configuration -->
                <settings-panel displayName="dashboard.axisConfig" expanded="${true}">
                    <div style="padding-bottom: 12px; display: flex; flex-direction: column; gap: 16px;">

                        <!-- Left axis configuration -->
                        <div>
                            ${when(isMultiAxis, () => html`
                                <div style="margin-bottom: 8px;">
                                    <span><or-translate value="dashboard.leftAxis"></or-translate></span>
                                </div>
                            `)}
                            <div style="display: flex;">
                                ${max !== undefined ? html`
                                    <or-mwc-input .type="${InputType.NUMBER}" label="${i18next.t('yAxis') + ' ' + i18next.t('max')}" .value="${max}" style="width: 100%;"
                                                  @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueChange('left', 'max', ev)}"
                                    ></or-mwc-input>
                                ` : html`
                                    <or-mwc-input .type="${InputType.TEXT}" label="${i18next.t('yAxis') + ' ' + i18next.t('max')}" disabled="true" value="auto" style="width: 100%;"></or-mwc-input>
                                `}
                                <or-mwc-input .type="${InputType.SWITCH}" style="margin: 0 -10px 0 0;" .value="${max !== undefined}"
                                              @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueToggle('left', 'max', ev)}"
                                ></or-mwc-input>
                            </div>
                            <div style="display: flex; margin-top: 12px;">
                                ${min !== undefined ? html`
                                    <or-mwc-input .type="${InputType.NUMBER}" label="${i18next.t('yAxis') + ' ' + i18next.t('min')}" .value="${min}" style="width: 100%;"
                                                  @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueChange('left', 'min', ev)}"
                                    ></or-mwc-input>
                                ` : html`
                                    <or-mwc-input .type="${InputType.TEXT}" label="${i18next.t('yAxis') + ' ' + i18next.t('min')}" disabled="true" value="auto" style="width: 100%;"></or-mwc-input>
                                `}
                                <or-mwc-input .type="${InputType.SWITCH}" style="margin: 0 -10px 0 0;" .value="${min !== undefined}"
                                              @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueToggle('left', 'min', ev)}"
                                ></or-mwc-input>
                            </div>
                        </div>

                        <!-- Right axis configuration -->
                        ${when(isMultiAxis, () => {
                            const rightMin = this.widgetConfig.chartOptions.options?.scales?.y1?.min;
                            const rightMax = this.widgetConfig.chartOptions.options?.scales?.y1?.max;
                            return html`
                                <div>
                                    <div style="margin-bottom: 8px;">
                                        <span><or-translate value="dashboard.rightAxis"></or-translate></span>
                                    </div>
                                    <div style="display: flex;">
                                        ${rightMax !== undefined ? html`
                                            <or-mwc-input .type="${InputType.NUMBER}" label="${i18next.t('yAxis') + ' ' + i18next.t('max')}" .value="${rightMax}" style="width: 100%;"
                                                          @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueChange('right', 'max', ev)}"
                                            ></or-mwc-input>
                                        ` : html`
                                            <or-mwc-input .type="${InputType.TEXT}" label="${i18next.t('yAxis') + ' ' + i18next.t('max')}" disabled="true" value="auto"
                                                          style="width: 100%;"></or-mwc-input>
                                        `}
                                        <or-mwc-input .type="${InputType.SWITCH}" style="margin: 0 -10px 0 0;" .value="${rightMax !== undefined}"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueToggle('right', 'max', ev)}"
                                        ></or-mwc-input>
                                    </div>
                                    <div style="display: flex; margin-top: 12px;">
                                        ${rightMin !== undefined ? html`
                                            <or-mwc-input .type="${InputType.NUMBER}" label="${i18next.t('yAxis') + ' ' + i18next.t('min')}" .value="${rightMin}" style="width: 100%;"
                                                          @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueChange('right', 'min', ev)}"
                                            ></or-mwc-input>
                                        ` : html`
                                            <or-mwc-input .type="${InputType.TEXT}" label="${i18next.t('yAxis') + ' ' + i18next.t('min')}" disabled="true" value="auto"
                                                          style="width: 100%;"></or-mwc-input>
                                        `}
                                        <or-mwc-input .type="${InputType.SWITCH}" style="margin: 0 -10px 0 0;" .value="${rightMin !== undefined}"
                                                      @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onMinMaxValueToggle('right', 'min', ev)}"
                                        ></or-mwc-input>
                                    </div>
                                </div>
                            `
                        })}
                    </div>
                </settings-panel>

                <!-- Data sampling options -->
                <settings-panel displayName="dataSampling" expanded="${true}">
                    <div style="padding-bottom: 12px; display: flex; flex-direction: column; gap: 12px;">
                        <div>
                            <or-mwc-input .type="${InputType.SELECT}" style="width: 100%" .options="${Array.from(this.samplingOptions.keys())}" .value="${samplingValue}"
                                          label="${i18next.t('algorithm')}" @or-mwc-input-changed="${(ev: OrInputChangedEvent) => this.onSamplingQueryChange(ev)}"
                            ></or-mwc-input>
                        </div>
                        <div>
                            ${this.getSamplingOptionsTemplate(this.widgetConfig.datapointQuery.type)}
                        </div>
                    </div>
                </settings-panel>
            </div>
        `;
    }

    protected getSamplingOptionsTemplate(type: any): TemplateResult {
        switch (type) {
            case 'interval': {
                const intervalQuery = this.widgetConfig.datapointQuery as AssetDatapointIntervalQuery;
                const formulaOptions = [AssetDatapointIntervalQueryFormula.AVG, AssetDatapointIntervalQueryFormula.MIN, AssetDatapointIntervalQueryFormula.MAX];
                return html`
                    <or-mwc-input .type="${InputType.SELECT}" style="width: 100%;" .options="${formulaOptions}"
                                  .value="${intervalQuery.formula}" label="${i18next.t('algorithmMethod')}" @or-mwc-input-changed="${(event: OrInputChangedEvent) => {
                        intervalQuery.formula = event.detail.value;
                        this.notifyConfigUpdate();
                    }}"
                    ></or-mwc-input>
                `;
            }
            default:
                return html``;
        }
    }

    // When a user clicks on ANY action in the attribute list, we want to switch between LEFT and RIGHT axis.
    // Since that is the only action, there is no need to check the ev.action variable.
    protected onAttributeAction(ev: AttributeActionEvent) {
        if(this.widgetConfig.attributeRefs.indexOf(ev.detail.attributeRef) >= 0) {
            if(this.widgetConfig.rightAxisAttributes.includes(ev.detail.attributeRef)) {
                this.removeFromRightAxis(ev.detail.attributeRef);
            } else {
                this.addToRightAxis(ev.detail.attributeRef);
            }
            this.notifyConfigUpdate();
        }
    }

    // When the list of attributeRefs is changed by the asset selector,
    // we should remove the "right axis" references for the attributes that got removed.
    // Also update the WidgetConfig attributeRefs field as usual
    protected onAttributesSelect(ev: AttributesSelectEvent) {
        const removedAttributeRefs = this.widgetConfig.attributeRefs.filter(ar => !ev.detail.attributeRefs.includes(ar));
        removedAttributeRefs.forEach(raf => this.removeFromRightAxis(raf));
        this.widgetConfig.attributeRefs = ev.detail.attributeRefs;
        this.notifyConfigUpdate();
    }

    protected addToRightAxis(attributeRef: AttributeRef, notify = false) {
        if(!this.widgetConfig.rightAxisAttributes.includes(attributeRef)) {
            this.widgetConfig.rightAxisAttributes.push(attributeRef);
            if(notify) {
                this.notifyConfigUpdate();
            }
        }
    }

    protected removeFromRightAxis(attributeRef: AttributeRef, notify = false) {
        if(this.widgetConfig.rightAxisAttributes.includes(attributeRef)) {
            this.widgetConfig.rightAxisAttributes.splice(this.widgetConfig.rightAxisAttributes.indexOf(attributeRef), 1);
            if(notify) {
                this.notifyConfigUpdate();
            }
        }
    }

    protected onTimePresetSelect(ev: OrInputChangedEvent) {
        this.widgetConfig.defaultTimePresetKey = ev.detail.value.toString();
        this.notifyConfigUpdate();
    }

    protected onTimestampControlsToggle(ev: OrInputChangedEvent) {
        this.widgetConfig.showTimestampControls = !ev.detail.value;
        this.notifyConfigUpdate();
    }

    protected onShowLegendToggle(ev: OrInputChangedEvent) {
        this.widgetConfig.showLegend = ev.detail.value;
        this.notifyConfigUpdate();
    }

    protected onShowGridToggle(ev: OrInputChangedEvent) {
        const enabled = ev.detail.value as boolean;
        this.widgetConfig.showGrid = enabled;
        // Ensure structure exists
        this.widgetConfig.chartOptions = this.widgetConfig.chartOptions || {};
        this.widgetConfig.chartOptions.options = this.widgetConfig.chartOptions.options || {};
        this.widgetConfig.chartOptions.options.scales = this.widgetConfig.chartOptions.options.scales || {};
        const scales = this.widgetConfig.chartOptions.options.scales;
        scales.x = scales.x || {};
        scales.x.grid = scales.x.grid || {};
        scales.y = scales.y || {};
        scales.y.grid = scales.y.grid || {};
        // Apply display flags
        scales.x.grid.display = enabled;
        scales.y.grid.display = enabled;
        // Apply colors based on current intensities
        const xi = this.widgetConfig.gridXIntensity ?? 0.2;
        const yi = this.widgetConfig.gridYIntensity ?? 0.2;
        scales.x.grid.color = this.getGridColor(xi);
        scales.y.grid.color = this.getGridColor(yi);
        this.notifyConfigUpdate();
    }

    protected onGridIntensityChange(axis: 'x' | 'y', ev: OrInputChangedEvent) {
        const val = Math.max(0, Math.min(1, Number(ev.detail.value)));
        if(axis === 'x') {
            this.widgetConfig.gridXIntensity = val;
        } else {
            this.widgetConfig.gridYIntensity = val;
        }
        // Ensure structure exists
        this.widgetConfig.chartOptions = this.widgetConfig.chartOptions || {};
        this.widgetConfig.chartOptions.options = this.widgetConfig.chartOptions.options || {};
        this.widgetConfig.chartOptions.options.scales = this.widgetConfig.chartOptions.options.scales || {};
        const scales = this.widgetConfig.chartOptions.options.scales;
        if(axis === 'x') {
            scales.x = scales.x || {};
            scales.x.grid = scales.x.grid || {};
            scales.x.grid.color = this.getGridColor(val);
            if(this.widgetConfig.showGrid !== false) { scales.x.grid.display = true; }
        } else {
            scales.y = scales.y || {};
            scales.y.grid = scales.y.grid || {};
            scales.y.grid.color = this.getGridColor(val);
            if(this.widgetConfig.showGrid !== false) { scales.y.grid.display = true; }
        }
        this.notifyConfigUpdate();
    }

    protected getGridColor(alpha: number): string {
        // Neutral black with variable alpha for visibility across themes.
        return `rgba(0,0,0,${alpha})`;
    }

    protected onXAxisUnitChange(ev: OrInputChangedEvent) {
        const unit = String(ev.detail.value || 'second');
        this.widgetConfig.chartOptions = this.widgetConfig.chartOptions || {};
        this.widgetConfig.chartOptions.options = this.widgetConfig.chartOptions.options || {};
        this.widgetConfig.chartOptions.options.scales = this.widgetConfig.chartOptions.options.scales || {};
        const scales = this.widgetConfig.chartOptions.options.scales;
        scales.x = scales.x || {};
        scales.x.time = scales.x.time || {};
        scales.x.time.unit = unit;
        this.notifyConfigUpdate();
    }

    protected onXAxisStepSizeChange(ev: OrInputChangedEvent) {
        let step = Number(ev.detail.value);
        if (isNaN(step) || step <= 0) { step = 1; }
        this.widgetConfig.chartOptions = this.widgetConfig.chartOptions || {};
        this.widgetConfig.chartOptions.options = this.widgetConfig.chartOptions.options || {};
        this.widgetConfig.chartOptions.options.scales = this.widgetConfig.chartOptions.options.scales || {};
        const scales = this.widgetConfig.chartOptions.options.scales;
        scales.x = scales.x || {};
        scales.x.time = scales.x.time || {};
        scales.x.time.stepSize = Math.round(step);
        this.notifyConfigUpdate();
    }

    protected onGridDensityChange(axis: 'x' | 'y', ev: OrInputChangedEvent) {
        // Accept any number, including floats < 1. Store raw value and derive an effective integer for Chart.js.
        let raw = Number(ev.detail.value);
        if (isNaN(raw)) { raw = 1; }
        if(axis === 'x') {
            this.widgetConfig.gridXDensity = raw;
        } else {
            this.widgetConfig.gridYDensity = raw;
        }
        // Compute effective maxTicksLimit
        const base = 10; // baseline tick count used when raw < 1 (acts as a multiplier)
        let effective: number;
        if (raw <= 0) {
            effective = 2; // minimal sensible number of ticks
        } else if (raw < 1) {
            effective = Math.max(2, Math.round(base * raw));
        } else {
            effective = Math.max(2, Math.round(raw));
        }
        // Cap to avoid excessive rendering cost
        effective = Math.min(100, effective);

        // Ensure structure exists
        this.widgetConfig.chartOptions = this.widgetConfig.chartOptions || {};
        this.widgetConfig.chartOptions.options = this.widgetConfig.chartOptions.options || {};
        this.widgetConfig.chartOptions.options.scales = this.widgetConfig.chartOptions.options.scales || {};
        const scales = this.widgetConfig.chartOptions.options.scales;
        if(axis === 'x') {
            scales.x = scales.x || {};
            scales.x.ticks = scales.x.ticks || {};
            scales.x.ticks.maxTicksLimit = effective;
        } else {
            scales.y = scales.y || {};
            scales.y.ticks = scales.y.ticks || {};
            scales.y.ticks.maxTicksLimit = effective;
        }
        this.notifyConfigUpdate();
    }

    protected setAxisMinMaxValue(axis: 'left' | 'right', type: 'min' | 'max', value?: number) {
        if(axis === 'left') {
            if(type === 'min') {
                this.widgetConfig.chartOptions.options.scales.y.min = value;
            } else {
                this.widgetConfig.chartOptions.options.scales.y.max = value;
            }
        } else {
            if(type === 'min') {
                this.widgetConfig.chartOptions.options.scales.y1.min = value;
            } else {
                this.widgetConfig.chartOptions.options.scales.y1.max = value;
            }
        }
        this.notifyConfigUpdate();
    }

    protected onMinMaxValueChange(axis: 'left' | 'right', type: 'min' | 'max', ev: OrInputChangedEvent) {
        this.setAxisMinMaxValue(axis, type, ev.detail.value);
    }

    protected onMinMaxValueToggle(axis: 'left' | 'right', type: 'min' | 'max', ev: OrInputChangedEvent) {
        this.setAxisMinMaxValue(axis, type, (ev.detail.value ? (type === 'min' ? 0 : 100) : undefined));
    }

    protected onSamplingQueryChange(ev: OrInputChangedEvent) {
        this.widgetConfig.datapointQuery.type = this.samplingOptions.get(ev.detail.value)! as any;
        this.notifyConfigUpdate();
    }
}
