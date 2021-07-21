import { observer } from "mobx-react";
import React, { useState, ChangeEventHandler, useEffect } from "react";
import { Complete } from "../../../Core/TypeModifiers";
import DiscretelyTimeVaryingMixin from "../../../ModelMixins/DiscretelyTimeVaryingMixin";
import hasTraits from "../../../Models/Definition/hasTraits";
import { BaseModel } from "../../../Models/Definition/Model";
import { DEFAULT_PLACEMENT } from "../../../Models/SelectableDimensions/SelectableDimensions";
import ViewState from "../../../ReactViewModels/ViewState";
import WebMapServiceCatalogItemTraits from "../../../Traits/TraitsClasses/WebMapServiceCatalogItemTraits";
import ChartItemSelector from "./ChartItemSelector";
import ColorScaleRangeSection from "./ColorScaleRangeSection";
import DateTimeSelectorSection from "./DateTimeSelectorSection";
import FilterSection from "./FilterSection";
import LeftRightSection from "./LeftRightSection";
import Legend from "./Legend";
import OpacitySection from "./OpacitySection";
import SatelliteImageryTimeFilterSection from "./SatelliteImageryTimeFilterSection";
import { ScaleWorkbenchInfo } from "./ScaleWorkbenchInfo";
import DimensionSelectorSection from "./SelectableDimensionSection";
import ShortReport from "./ShortReport";
import TimerSection from "./TimerSection";
import ViewingControls from "./ViewingControls";
import CatalogMemberTraits from "../../../Traits/TraitsClasses/CatalogMemberTraits";
import { runInAction } from "mobx";
import CommonStrata from "../../../Models/Definition/CommonStrata";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";

type WorkbenchControls = {
  viewingControls?: boolean;
  opacity?: boolean;
  scaleWorkbench?: boolean;
  splitter?: boolean;
  timer?: boolean;
  chartItems?: boolean;
  filter?: boolean;
  dateTime?: boolean;
  timeFilter?: boolean;
  selectableDimensions?: boolean;
  colorScaleRange?: boolean;
  shortReport?: boolean;
  legend?: boolean;
};

type WorkbenchItemControlsProps = {
  item: BaseModel;
  viewState: ViewState;
  /** Flag to show each control - defaults to all true */
  controls?: WorkbenchControls;
};

export const defaultControls: Complete<WorkbenchControls> = {
  viewingControls: true,
  opacity: true,
  scaleWorkbench: true,
  splitter: true,
  timer: true,
  chartItems: true,
  filter: true,
  dateTime: true,
  timeFilter: true,
  selectableDimensions: true,
  colorScaleRange: true,
  shortReport: true,
  legend: true
};

export const hideAllControls: Complete<WorkbenchControls> = {
  viewingControls: false,
  opacity: false,
  scaleWorkbench: false,
  splitter: false,
  timer: false,
  chartItems: false,
  filter: false,
  dateTime: false,
  timeFilter: false,
  selectableDimensions: false,
  colorScaleRange: false,
  shortReport: false,
  legend: false
};

const getSwitchableUrls = (
  item: BaseModel | CatalogMemberTraits
): { url: string; name: string }[] | null => {
  if (
    !("customProperties" in item) ||
    !item.customProperties ||
    !item.customProperties.switchableUrls
  ) {
    return null;
  }
  return item.customProperties.switchableUrls as any;
};

const WorkbenchItemControls: React.FC<WorkbenchItemControlsProps> = observer(
  ({ item, viewState, controls: controlsWithoutDefaults }) => {
    // Apply controls from props on top of defaultControls
    const controls = { ...defaultControls, ...controlsWithoutDefaults };
    const [{ switchableUrls, urlIndex }, setSwitchableUrlsState] = useState(
      () => ({
        urlIndex: 0,
        switchableUrls: getSwitchableUrls(item)
      })
    );
    const handleSwitchableUrlChange: ChangeEventHandler<HTMLInputElement> = (
      e
    ) => {
      setSwitchableUrlsState((prevState) => ({
        ...prevState,
        urlIndex: Number(e.target.value)
      }));
    };
    useEffect(() => {
      runInAction(() => {
        if (!switchableUrls) return;
        if (!MappableMixin.isMixedInto(item)) return;
        if (!UrlMixin.isMixedInto(item)) return;
        item.setTrait(CommonStrata.user, "url", switchableUrls[urlIndex].url);
        item.loadMapItems();
      });
    }, [item, switchableUrls, urlIndex]);

    return (
      <>
        {controls?.viewingControls ? (
          <ViewingControls item={item} viewState={viewState} />
        ) : null}
        {controls?.opacity ? <OpacitySection item={item} /> : null}
        {controls?.scaleWorkbench ? <ScaleWorkbenchInfo item={item} /> : null}
        {controls?.timer ? <TimerSection item={item} /> : null}
        {controls?.splitter ? <LeftRightSection item={item as any} /> : null}
        {controls?.chartItems ? <ChartItemSelector item={item} /> : null}
        {controls?.filter ? <FilterSection item={item} /> : null}
        {controls?.dateTime && DiscretelyTimeVaryingMixin.isMixedInto(item) ? (
          <DateTimeSelectorSection item={item} />
        ) : null}
        {controls?.timeFilter ? (
          <SatelliteImageryTimeFilterSection item={item} />
        ) : null}
        {controls?.selectableDimensions ? (
          <DimensionSelectorSection item={item} placement={DEFAULT_PLACEMENT} />
        ) : null}
        {/* TODO: remove min max props and move the checks to
      ColorScaleRangeSection to keep this component simple. */}
        {controls?.colorScaleRange &&
          hasTraits(
            item,
            WebMapServiceCatalogItemTraits,
            "colorScaleMinimum"
          ) &&
          hasTraits(
            item,
            WebMapServiceCatalogItemTraits,
            "colorScaleMaximum"
          ) && (
            <ColorScaleRangeSection
              item={item}
              minValue={item.colorScaleMinimum}
              maxValue={item.colorScaleMaximum}
            />
          )}

        {switchableUrls && (
          <div
            css={`
              margin: 5px 0;
            `}
          >
            {switchableUrls.map((su, i) => (
              <div key={i}>
                <label>
                  <input
                    type="radio"
                    value={i}
                    onChange={handleSwitchableUrlChange}
                    checked={urlIndex === i}
                  />
                  {su.name}
                </label>
              </div>
            ))}
          </div>
        )}
        {controls?.shortReport ? <ShortReport item={item} /> : null}
        {controls?.legend ? <Legend item={item} /> : null}
        {controls?.selectableDimensions ? (
          <DimensionSelectorSection item={item} placement={"belowLegend"} />
        ) : null}
      </>
    );
  }
);

export default WorkbenchItemControls;
