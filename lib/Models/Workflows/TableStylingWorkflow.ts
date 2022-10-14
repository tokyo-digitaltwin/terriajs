import {
  action,
  computed,
  IReactionDisposer,
  observable,
  ObservableMap,
  reaction,
  runInAction
} from "mobx";
import filterOutUndefined from "../../Core/filterOutUndefined";
import isDefined from "../../Core/isDefined";
import TerriaError from "../../Core/TerriaError";
import ConstantColorMap from "../../Map/ColorMap/ConstantColorMap";
import ContinuousColorMap from "../../Map/ColorMap/ContinuousColorMap";
import DiscreteColorMap from "../../Map/ColorMap/DiscreteColorMap";
import EnumColorMap from "../../Map/ColorMap/EnumColorMap";
import { allIcons, getMakiIcon } from "../../Map/Icons/Maki/MakiIcons";
import { getName } from "../../ModelMixins/CatalogMemberMixin";
import { isDataSource } from "../../ModelMixins/MappableMixin";
import TableMixin from "../../ModelMixins/TableMixin";
import {
  QualitativeColorSchemeOptionRenderer,
  QuantitativeColorSchemeOptionRenderer
} from "../../ReactViews/SelectableDimensions/ColorSchemeOptionRenderer";
import { MarkerOptionRenderer } from "../../ReactViews/SelectableDimensions/MarkerOptionRenderer";
import Icon from "../../Styled/Icon";
import {
  DEFAULT_DIVERGING,
  DEFAULT_QUALITATIVE,
  DEFAULT_SEQUENTIAL,
  DIVERGING_SCALES,
  QUALITATIVE_SCALES,
  SEQUENTIAL_CONTINUOUS_SCALES,
  SEQUENTIAL_SCALES
} from "../../Table/TableColorMap";
import TableColumnType from "../../Table/TableColumnType";
import TableStyleMap from "../../Table/TableStyleMap";
import ModelTraits from "../../Traits/ModelTraits";
import { EnumColorTraits } from "../../Traits/TraitsClasses/TableColorStyleTraits";
import CommonStrata from "../Definition/CommonStrata";
import Model from "../Definition/Model";
import ModelPropertiesFromTraits from "../Definition/ModelPropertiesFromTraits";
import {
  FlatSelectableDimension,
  SelectableDimension,
  SelectableDimensionButton,
  SelectableDimensionColor,
  SelectableDimensionGroup,
  SelectableDimensionNumeric,
  SelectableDimensionText
} from "../SelectableDimensions/SelectableDimensions";
import ViewingControls from "../ViewingControls";
import SelectableDimensionWorkflow, {
  SelectableDimensionWorkflowGroup
} from "../Workflows/SelectableDimensionWorkflow";
import i18next from "i18next";

/** The ColorSchemeType is used to change which SelectableDimensions are shown.
 * It is basically the "mode" of the TableStylingWorkflow
 *
 * For example - if we are using "sequential-continuous" - then the dimensions will be shown to configure the following:
 * - Sequential color scales
 * - Minimum/Maximum values
 */
type ColorSchemeType =
  | "no-style"
  | "sequential-continuous"
  | "sequential-discrete"
  | "diverging-continuous"
  | "diverging-discrete"
  | "custom-discrete"
  | "qualitative"
  | "custom-qualitative";

type StyleType = "fill" | "point-size" | "point" | "outline";

/** Columns/Styles with the following TableColumnTypes will be hidden unless we are showing "advanced" options */
export const ADVANCED_TABLE_COLUMN_TYPES = [
  TableColumnType.latitude,
  TableColumnType.longitude,
  TableColumnType.region,
  TableColumnType.time
];

/** SelectableDimensionWorkflow to set styling options for TableMixin models */
export default class TableStylingWorkflow
  implements SelectableDimensionWorkflow
{
  static type = "table-styling";

  /** This is used to simplify SelectableDimensions available to the user.
   * For example - if equal to `diverging-continuous` - then only Diverging continuous color scales will be presented as options
   * See setColorSchemeTypeFromPalette and setColorSchemeType for how this is set. */
  @observable colorSchemeType: ColorSchemeType | undefined;
  @observable styleType: StyleType = "fill";

  /** Which bin is currently open in `binMaximumsSelectableDims` or `enumColorsSelectableDim`.
   * This is used in `SelectableDimensionGroup.onToggle` and `SelectableDimensionGroup.isOpen` to make the groups act like an accordion - so only one bin can be edited at any given time.
   */
  @observable
  private readonly openBinIndex = new ObservableMap<
    StyleType,
    number | undefined
  >();

  private activeStyleDisposer: IReactionDisposer;

  constructor(readonly item: TableMixin.Instance) {
    // We need to reset colorSchemeType every time Table.activeStyle changes
    this.activeStyleDisposer = reaction(
      () => this.item.activeStyle,
      () => {
        // If the active style is of "advanced" TableColumnType, then set colorSchemeType to "no-style"
        if (
          isDefined(this.item.activeTableStyle.colorColumn) &&
          ADVANCED_TABLE_COLUMN_TYPES.includes(
            this.item.activeTableStyle.colorColumn.type
          )
        ) {
          runInAction(() => (this.colorSchemeType = "no-style"));
        } else {
          this.setColorSchemeTypeFromPalette();
        }
      }
    );
    this.setColorSchemeTypeFromPalette();
  }

  onClose() {
    this.activeStyleDisposer();
  }

  @computed
  get menu() {
    return {
      options: filterOutUndefined([
        {
          text: this.showAdvancedOptions
            ? i18next.t("models.tableStyling.hideAdvancedOptions")
            : i18next.t("models.tableStyling.showAdvancedOptions"),
          onSelect: action(() => {
            this.showAdvancedOptions = !this.showAdvancedOptions;
          })
        },
        this.showAdvancedOptions
          ? {
              text: i18next.t("models.tableStyling.copyUserStratum"),
              onSelect: () => {
                const stratum = JSON.stringify(
                  this.item.strata.get(CommonStrata.user)
                );
                try {
                  navigator.clipboard.writeText(
                    JSON.stringify(this.item.strata.get(CommonStrata.user))
                  );
                } catch (e) {
                  TerriaError.from(e).raiseError(
                    this.item.terria,
                    "Failed to copy to clipboard. User stratum has been printed to console"
                  );
                  console.log(stratum);
                }
              },
              disable: !this.showAdvancedOptions
            }
          : undefined
      ])
    };
  }

  get name() {
    return i18next.t("models.tableStyling.name");
  }

  get icon() {
    return Icon.GLYPHS.layers;
  }

  get footer() {
    return {
      buttonText: i18next.t("models.tableStyling.reset"),
      /** Delete all user strata values for TableColumnTraits and TableStyleTraits for the current activeStyle */
      onClick: action(() => {
        this.getTableColumnTraits(CommonStrata.user)?.strata.delete(
          CommonStrata.user
        );
        this.getTableStyleTraits(CommonStrata.user)?.strata.delete(
          CommonStrata.user
        );
        this.setColorSchemeTypeFromPalette();
      })
    };
  }

  /** This will look at the current `colorMap` and `colorPalette` to guess which `colorSchemeType` is active.
   * This is because `TableMixin` doesn't have an explicit `"colorSchemeType"` flag - it will choose the appropriate type based on `TableStyleTraits`
   * `colorTraits.colorPalette` is also set here if we are only using `tableColorMap.defaultColorPaletteName`
   */
  @action
  setColorSchemeTypeFromPalette(): void {
    const colorMap = this.tableStyle.colorMap;
    const colorPalette = this.tableStyle.colorTraits.colorPalette;
    const defaultColorPalette =
      this.tableStyle.tableColorMap.defaultColorPaletteName;

    const colorPaletteWithDefault = colorPalette ?? defaultColorPalette;

    this.colorSchemeType = undefined;

    if (colorMap instanceof ConstantColorMap) {
      this.colorSchemeType = "no-style";
    } else if (colorMap instanceof ContinuousColorMap) {
      if (
        SEQUENTIAL_SCALES.includes(colorPaletteWithDefault) ||
        SEQUENTIAL_CONTINUOUS_SCALES.includes(colorPaletteWithDefault)
      ) {
        this.colorSchemeType = "sequential-continuous";
        if (!colorPalette) {
          this.getTableStyleTraits(CommonStrata.user)?.color.setTrait(
            CommonStrata.user,
            "colorPalette",
            DEFAULT_SEQUENTIAL
          );
        }
      } else if (DIVERGING_SCALES.includes(colorPaletteWithDefault)) {
        this.colorSchemeType = "diverging-continuous";
        if (!colorPalette) {
          this.getTableStyleTraits(CommonStrata.user)?.color.setTrait(
            CommonStrata.user,
            "colorPalette",
            DEFAULT_DIVERGING
          );
        }
      }
    } else if (colorMap instanceof DiscreteColorMap) {
      {
        if (
          this.tableStyle.colorTraits.binColors &&
          this.tableStyle.colorTraits.binColors.length > 0
        ) {
          this.colorSchemeType = "custom-discrete";
        } else if (SEQUENTIAL_SCALES.includes(colorPaletteWithDefault)) {
          this.colorSchemeType = "sequential-discrete";
          if (!colorPalette) {
            this.getTableStyleTraits(CommonStrata.user)?.color.setTrait(
              CommonStrata.user,
              "colorPalette",
              DEFAULT_SEQUENTIAL
            );
          }
        } else if (DIVERGING_SCALES.includes(colorPaletteWithDefault)) {
          this.colorSchemeType = "diverging-discrete";
          if (!colorPalette) {
            this.getTableStyleTraits(CommonStrata.user)?.color.setTrait(
              CommonStrata.user,
              "colorPalette",
              DEFAULT_DIVERGING
            );
          }
        }
      }
    } else if (
      colorMap instanceof EnumColorMap &&
      QUALITATIVE_SCALES.includes(colorPaletteWithDefault)
    ) {
      if (
        this.tableStyle.colorTraits.enumColors &&
        this.tableStyle.colorTraits.enumColors.length > 0
      ) {
        this.colorSchemeType = "custom-qualitative";
      } else {
        this.colorSchemeType = "qualitative";
        if (!colorPalette) {
          this.getTableStyleTraits(CommonStrata.user)?.color.setTrait(
            CommonStrata.user,
            "colorPalette",
            DEFAULT_QUALITATIVE
          );
        }
      }
    }
  }

  /** Handle change on colorType - this is called by the  */
  @action setColorSchemeType(stratumId: string, id: string | undefined) {
    if (!id) return;
    // Set `activeStyle` trait so the value doesn't change
    this.item.setTrait(stratumId, "activeStyle", this.tableStyle.id);

    // Hide any open bin
    this.openBinIndex.clear();

    // Here we use item.activeTableStyle.colorTraits.colorPalette instead of this.colorPalette because we only want this to be defined, if the trait is defined - we don't care about defaultColorPaletteName
    const colorPalette = this.tableStyle.colorTraits.colorPalette;

    // **Discrete color maps**
    // Reset bins
    if (id === "sequential-discrete" || id === "diverging-discrete") {
      this.colorSchemeType = id;
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "mapType",
        "bin"
      );
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "binColors",
        []
      );

      // Set numberOfBins according to limits of sequential and diverging color scales:
      // - Sequential is [3,9]
      // - Diverging is [3,11]

      // If numberOfBins is 0 - set to sensible default (7)
      if (this.tableStyle.colorTraits.numberOfBins === 0) {
        this.getTableStyleTraits(stratumId)?.color.setTrait(
          stratumId,
          "numberOfBins",
          7
        );
      } else if (
        id === "sequential-discrete" &&
        this.tableStyle.tableColorMap.binColors.length > 9
      ) {
        this.getTableStyleTraits(stratumId)?.color.setTrait(
          stratumId,
          "numberOfBins",
          9
        );
      } else if (
        id === "diverging-discrete" &&
        this.tableStyle.tableColorMap.binColors.length > 11
      ) {
        this.getTableStyleTraits(stratumId)?.color.setTrait(
          stratumId,
          "numberOfBins",
          11
        );
      } else if (this.tableStyle.tableColorMap.binColors.length < 3) {
        this.getTableStyleTraits(stratumId)?.color.setTrait(
          stratumId,
          "numberOfBins",
          3
        );
      }

      // If no user stratum - reset bin maximums
      if (!this.tableStyle.colorTraits.strata.get(stratumId)?.binMaximums) {
        this.resetBinMaximums(stratumId);
      }
    }
    // **Continuous color maps**
    else if (id === "sequential-continuous" || id === "diverging-continuous") {
      this.colorSchemeType = id;
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "mapType",
        "continuous"
      );
    }
    // **Qualitative (enum) color maps**
    else if (id === "qualitative") {
      this.colorSchemeType = id;
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "mapType",
        "enum"
      );
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "enumColors",
        []
      );
    }

    // **No style (constant) color maps**
    else if (id === "no-style") {
      this.colorSchemeType = id;
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "mapType",
        "constant"
      );
    }

    // If the current colorPalette is incompatible with the selected type - change colorPalette to default for the selected type
    if (
      id === "sequential-continuous" &&
      (!colorPalette ||
        ![...SEQUENTIAL_SCALES, ...SEQUENTIAL_CONTINUOUS_SCALES].includes(
          colorPalette
        ))
    ) {
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "colorPalette",
        DEFAULT_SEQUENTIAL
      );
    }
    if (
      id === "sequential-discrete" &&
      (!colorPalette || !SEQUENTIAL_SCALES.includes(colorPalette))
    ) {
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "colorPalette",
        DEFAULT_SEQUENTIAL
      );
    }
    if (
      (id === "diverging-continuous" || id === "diverging-discrete") &&
      (!colorPalette || !DIVERGING_SCALES.includes(colorPalette))
    ) {
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "colorPalette",
        DEFAULT_DIVERGING
      );
    }
    if (
      id === "qualitative" &&
      (!colorPalette || !QUALITATIVE_SCALES.includes(colorPalette))
    ) {
      this.getTableStyleTraits(stratumId)?.color.setTrait(
        stratumId,
        "colorPalette",
        DEFAULT_QUALITATIVE
      );
    }
  }

  /** Show advances options
   * - Show all column types in "Data" select
   * - Show "Data type (advanced)" select. This allow user to change column type */
  @observable showAdvancedOptions: boolean = false;

  @computed get datasetSelectableDim(): SelectableDimension {
    return {
      type: "select",
      id: "dataset",
      name: i18next.t("models.tableStyling.dimensions.dataset.name"),
      selectedId: this.item.uniqueId,

      // Find all workbench items which have TableStylingWorkflow
      options: this.item.terria.workbench.items
        .filter(
          (item) =>
            ViewingControls.is(item) &&
            item.viewingControls.find(
              (control) => control.id === TableStylingWorkflow.type
            )
        )
        .map((item) => ({
          id: item.uniqueId,
          name: getName(item)
        })),
      setDimensionValue: (stratumId, value) => {
        const item = this.item.terria.workbench.items.find(
          (i) => i.uniqueId === value
        );
        if (item && TableMixin.isMixedInto(item)) {
          // Trigger new TableStylingWorkflow
          if (
            item.viewingControls.find(
              (control) => control.id === TableStylingWorkflow.type
            )
          ) {
            item.terria.selectableDimensionWorkflow = new TableStylingWorkflow(
              item
            );
          }
        }
      }
    };
  }

  /** Table Style dimensions:
   * - Dataset (Table models in workbench)
   * - Variable (Table style in model)
   * - TableColumn type (advanced only)
   */
  @computed get tableStyleSelectableDim(): SelectableDimensionWorkflowGroup {
    const showPointStyles = !!this.item.mapItems.find(
      (d) => isDataSource(d) && d.entities.values.length > 0
    );
    const showPointSize =
      showPointStyles &&
      (this.tableStyle.pointSizeColumn ||
        this.item.tableColumns.find((t) => t.type === TableColumnType.scalar));
    return {
      type: "group",
      id: "data",
      name: i18next.t("models.tableStyling.dimensions.data.name"),
      selectableDimensions: this.showAdvancedOptions
        ? [
            this.datasetSelectableDim,
            {
              type: "select",
              id: "table-style-id",
              name: i18next.t("models.tableStyling.dimensions.style.name"),
              selectedId: this.tableStyle.id,
              options: this.item.tableStyles.map((style) => ({
                id: style.id,
                name: style.title
              })),
              setDimensionValue: (stratumId, value) => {
                this.item.setTrait(stratumId, "activeStyle", value);
                // Note - the activeStyle reaction in TableStylingWorkflow.constructor handles all side effects
                // The reaction will call this.setColorSchemeTypeFromPalette()
              }
            },
            {
              type: "select",
              id: "table-color-col",
              name: i18next.t(
                "models.tableStyling.dimensions.colorColumn.name"
              ),
              selectedId: this.tableStyle.colorColumn?.name,
              options: this.item.tableColumns.map((col) => ({
                id: col.name,
                name: col.title
              })),
              setDimensionValue: (stratumId, value) => {
                this.getTableStyleTraits(stratumId)?.color.setTrait(
                  stratumId,
                  "colorColumn",
                  value
                );
              }
            },
            {
              type: "select",
              id: "data-type",
              name: i18next.t(
                "models.tableStyling.dimensions.colorColumnType.name"
              ),
              options: Object.keys(TableColumnType)
                .filter((type) => type.length > 1)
                .map((colType) => ({ id: colType })),
              selectedId: isDefined(this.tableStyle.colorColumn?.type)
                ? TableColumnType[this.tableStyle.colorColumn!.type]
                : undefined,
              setDimensionValue: (stratumId, id) => {
                this.getTableColumnTraits(stratumId)?.setTrait(
                  stratumId,
                  "type",
                  id
                );
                this.setColorSchemeTypeFromPalette();
              }
            }
          ]
        : [
            this.datasetSelectableDim,

            {
              type: "select",
              id: "table-style",
              name: i18next.t("models.tableStyling.dimensions.style.name"),
              selectedId: this.tableStyle.id,
              options: this.item.tableColumns
                // Filter out empty columns
                .filter(
                  (col) =>
                    col.uniqueValues.values.length > 0 &&
                    !ADVANCED_TABLE_COLUMN_TYPES.includes(col.type)
                )
                .map((col) => ({
                  id: col.name,
                  name: col.title
                })),
              setDimensionValue: (stratumId, value) => {
                this.item.setTrait(stratumId, "activeStyle", value);
                // Note - the activeStyle reaction in TableStylingWorkflow.constructor handles all side effects
                // The reaction will call this.setColorSchemeTypeFromPalette()
              }
            },
            {
              type: "select",
              id: "table-style-type",
              name: i18next.t("models.tableStyling.dimensions.symbology.name"),
              selectedId: this.styleType,
              options: filterOutUndefined([
                {
                  id: "fill",
                  name: i18next.t(
                    "models.tableStyling.dimensions.symbology.fill"
                  )
                },
                showPointSize
                  ? {
                      id: "point-size",
                      name: i18next.t(
                        "models.tableStyling.dimensions.symbology.pointSize"
                      )
                    }
                  : undefined,
                showPointStyles
                  ? {
                      id: "point",
                      name: i18next.t(
                        "models.tableStyling.dimensions.symbology.pointMarkerStyle"
                      )
                    }
                  : undefined,
                {
                  id: "outline",
                  name: i18next.t(
                    "models.tableStyling.dimensions.symbology.outlineColor"
                  )
                }
              ]),
              setDimensionValue: (stratumId, value) => {
                if (
                  value === "fill" ||
                  value === "point-size" ||
                  value === "point" ||
                  value === "outline"
                )
                  this.styleType = value;
              }
            }
          ]
    };
  }

  /** List of color schemes available for given `colorSchemeType` */
  @computed get colorSchemesForType() {
    const type = this.colorSchemeType;
    if (!isDefined(type)) return [];

    if (type === "sequential-continuous")
      return [...SEQUENTIAL_SCALES, ...SEQUENTIAL_CONTINUOUS_SCALES];
    if (type === "sequential-discrete") return SEQUENTIAL_SCALES;
    if (type === "diverging-discrete" || type === "diverging-continuous")
      return DIVERGING_SCALES;
    if (type === "qualitative") return QUALITATIVE_SCALES;

    return [];
  }

  /** Color scheme dimensions:
   * - Type (see `this.colorSchemeType`)
   * - Color scheme (see `this.colorSchemesForType`)
   * - Number of bins (for discrete)
   */
  @computed get colorSchemeSelectableDim(): SelectableDimensionWorkflowGroup {
    return {
      type: "group",
      id: "fill",
      name: i18next.t("models.tableStyling.dimensions.fill.name"),
      selectableDimensions: filterOutUndefined([
        this.tableStyle.colorColumn
          ? {
              type: "select",
              id: "type",
              name: i18next.t("models.tableStyling.dimensions.fillType.name"),
              undefinedLabel: i18next.t(
                "models.tableStyling.dimensions.fillType.undefinedLabel"
              ),
              options: filterOutUndefined([
                {
                  id: "no-style",
                  name: i18next.t(
                    "models.tableStyling.dimensions.fillType.noStyle"
                  )
                },
                ...(this.tableStyle.colorColumn.type === TableColumnType.scalar
                  ? [
                      {
                        id: "sequential-continuous",
                        name: i18next.t(
                          "models.tableStyling.dimensions.fillType.sequentialContinuous"
                        )
                      },
                      {
                        id: "sequential-discrete",
                        name: i18next.t(
                          "models.tableStyling.dimensions.fillType.sequentialDiscrete"
                        )
                      },
                      {
                        id: "diverging-continuous",
                        name: i18next.t(
                          "models.tableStyling.dimensions.fillType.divergentContinuous"
                        )
                      },
                      {
                        id: "diverging-discrete",
                        name: i18next.t(
                          "models.tableStyling.dimensions.fillType.divergentDiscrete"
                        )
                      }
                    ]
                  : []),
                {
                  id: "qualitative",
                  name: i18next.t(
                    "models.tableStyling.dimensions.fillType.qualitative"
                  )
                },
                // Add options for "custom" color palettes if we are in "custom-qualitative" or "custom-discrete" mode
                this.colorSchemeType === "custom-qualitative"
                  ? {
                      id: "custom-qualitative",
                      name: i18next.t(
                        "models.tableStyling.dimensions.fillType.customQualitative"
                      )
                    }
                  : undefined,
                this.colorSchemeType === "custom-discrete"
                  ? {
                      id: "custom-discrete",
                      name: i18next.t(
                        "models.tableStyling.dimensions.fillType.customDiscrete"
                      )
                    }
                  : undefined
              ]),
              selectedId: this.colorSchemeType,
              setDimensionValue: (stratumId, id) => {
                this.setColorSchemeType(stratumId, id);
              }
            }
          : undefined,

        {
          type: "select",
          id: "scheme",
          name: i18next.t("models.tableStyling.dimensions.scheme.name"),

          selectedId:
            this.tableStyle.colorTraits.colorPalette ??
            this.tableStyle.tableColorMap.defaultColorPaletteName,
          options: this.colorSchemesForType.map((style) => ({
            id: style
          })),
          optionRenderer:
            this.colorSchemeType === "qualitative"
              ? QualitativeColorSchemeOptionRenderer
              : QuantitativeColorSchemeOptionRenderer(
                  this.colorSchemeType === "sequential-discrete" ||
                    this.colorSchemeType === "diverging-discrete"
                    ? this.tableStyle.tableColorMap.binColors.length
                    : undefined
                ),
          setDimensionValue: (stratumId, id) => {
            this.getTableStyleTraits(stratumId)?.color.setTrait(
              stratumId,
              "colorPalette",
              id
            );
            this.getTableStyleTraits(stratumId)?.color.setTrait(
              stratumId,
              "binColors",
              []
            );
            this.getTableStyleTraits(stratumId)?.color.setTrait(
              stratumId,
              "enumColors",
              []
            );
          }
        },
        // Show "Number of Bins" if in discrete mode
        this.colorSchemeType === "sequential-discrete" ||
        this.colorSchemeType === "diverging-discrete"
          ? {
              type: "numeric",
              id: "numberOfBins",
              name: i18next.t(
                "models.tableStyling.dimensions.numberOfBins.name"
              ),
              allowUndefined: true,
              min:
                // Sequential and diverging color scales must have at least 3 bins
                this.colorSchemeType === "sequential-discrete" ||
                this.colorSchemeType === "diverging-discrete"
                  ? 3
                  : // Custom color scales only need at least 1
                    1,
              max:
                // Sequential discrete color scales support up to 9 bins
                this.colorSchemeType === "sequential-discrete"
                  ? 9
                  : // Diverging discrete color scales support up to 11 bins
                  this.colorSchemeType === "diverging-discrete"
                  ? 11
                  : // Custom discrete color scales can be any number of bins
                    undefined,
              value: this.tableStyle.colorTraits.numberOfBins,
              setDimensionValue: (stratumId, value) => {
                if (!isDefined(value)) return;
                this.getTableStyleTraits(stratumId)?.color.setTrait(
                  stratumId,
                  "numberOfBins",
                  value
                );

                this.resetBinMaximums(stratumId);
              }
            }
          : undefined
      ])
    };
  }

  @computed get minimumValueSelectableDim(): SelectableDimensionNumeric {
    return {
      type: "numeric",
      id: "min",
      name: i18next.t("models.tableStyling.dimensions.min.name"),
      max: this.tableStyle.tableColorMap.maximumValue,
      value: this.tableStyle.tableColorMap.minimumValue,
      setDimensionValue: (stratumId, value) => {
        this.getTableStyleTraits(stratumId)?.color.setTrait(
          stratumId,
          "minimumValue",
          value
        );
        if (
          this.colorSchemeType === "sequential-discrete" ||
          this.colorSchemeType === "diverging-discrete" ||
          this.colorSchemeType === "custom-discrete"
        ) {
          this.setBinMaximums(stratumId);
        }
      }
    };
  }

  /** Display range dimensions:
   * - Minimum value
   * - Maximum value
   */
  @computed get displayRangeDim(): SelectableDimensionWorkflowGroup {
    return {
      type: "group",
      id: "display-range",
      name: i18next.t("models.tableStyling.dimensions.displayRange.name"),
      isOpen: false,
      selectableDimensions: filterOutUndefined([
        this.minimumValueSelectableDim,
        {
          type: "numeric",
          id: "max",
          name: i18next.t("models.tableStyling.dimensions.max.name"),
          min: this.tableStyle.tableColorMap.minimumValue,
          value: this.tableStyle.tableColorMap.maximumValue,
          setDimensionValue: (stratumId, value) => {
            this.getTableStyleTraits(stratumId)?.color.setTrait(
              stratumId,
              "maximumValue",
              value
            );
          }
        },
        this.item.outlierFilterDimension
      ])
    };
  }

  /** Group to show bins with color, start/stop numbers.
   */
  @computed get binColorDims(): SelectableDimensionWorkflowGroup {
    return {
      type: "group",
      id: "bins",
      name: i18next.t("models.tableStyling.dimensions.bins.name"),
      isOpen: false,
      selectableDimensions: [
        ...this.tableStyle.tableColorMap.binMaximums
          .map(
            (bin, idx) =>
              ({
                type: "group",
                id: `bin-${idx}-start`,
                name: getColorPreview(
                  this.tableStyle.tableColorMap.binColors[idx] ?? "#aaa",
                  i18next.t("models.tableStyling.dimensions.binItem.range", {
                    value1:
                      idx === 0
                        ? this.minimumValueSelectableDim.value
                        : this.tableStyle.tableColorMap.binMaximums[idx - 1],
                    value2: bin
                  })
                ),
                isOpen: this.openBinIndex.get("fill") === idx,
                onToggle: (open) => {
                  if (open && this.openBinIndex.get("fill") !== idx) {
                    runInAction(() => this.openBinIndex.set("fill", idx));
                    return true;
                  }
                },
                selectableDimensions: [
                  {
                    type: "color",
                    id: `bin-${idx}-col`,
                    name: i18next.t(
                      "models.tableStyling.dimensions.binColor.name"
                    ),
                    value: this.tableStyle.tableColorMap.binColors[idx],
                    setDimensionValue: (stratumId, value) => {
                      const binColors = [
                        ...this.tableStyle.tableColorMap.binColors
                      ];
                      if (isDefined(value)) binColors[idx] = value;
                      this.getTableStyleTraits(stratumId)?.color.setTrait(
                        stratumId,
                        "binColors",
                        binColors
                      );
                      this.colorSchemeType = "custom-discrete";
                    }
                  },
                  idx === 0
                    ? this.minimumValueSelectableDim
                    : {
                        type: "numeric",
                        id: `bin-${idx}-start`,
                        name: i18next.t(
                          "models.tableStyling.dimensions.binStart.name"
                        ),
                        value:
                          this.tableStyle.tableColorMap.binMaximums[idx - 1],
                        setDimensionValue: (stratumId, value) => {
                          const binMaximums = [
                            ...this.tableStyle.tableColorMap.binMaximums
                          ];
                          if (isDefined(value)) binMaximums[idx - 1] = value;
                          this.setBinMaximums(stratumId, binMaximums);
                        }
                      },
                  {
                    type: "numeric",
                    id: `bin-${idx}-stop`,
                    name: i18next.t(
                      "models.tableStyling.dimensions.binStop.name"
                    ),
                    value: bin,
                    setDimensionValue: (stratumId, value) => {
                      const binMaximums = [
                        ...this.tableStyle.tableColorMap.binMaximums
                      ];
                      if (isDefined(value)) binMaximums[idx] = value;
                      this.setBinMaximums(stratumId, binMaximums);
                    }
                  }
                ]
              } as SelectableDimensionGroup)
          )
          .reverse() // Reverse array of bins to match Legend (descending order)
      ]
    };
  }

  /** Groups to show enum "bins" with colors and value */
  @computed get enumColorDims(): SelectableDimensionWorkflowGroup {
    return {
      type: "group",
      id: "colors",
      name: i18next.t("models.tableStyling.dimensions.enumColors.name"),
      isOpen: false,
      selectableDimensions: filterOutUndefined([
        ...this.tableStyle.tableColorMap.enumColors.map((enumCol, idx) => {
          if (!enumCol.value) return;
          const dims: SelectableDimensionGroup = {
            type: "group",
            id: `enum-${idx}-start`,
            name: getColorPreview(enumCol.color ?? "#aaa", enumCol.value),
            isOpen: this.openBinIndex.get("fill") === idx,
            onToggle: (open) => {
              if (open && this.openBinIndex.get("fill") !== idx) {
                runInAction(() => this.openBinIndex.set("fill", idx));
                return true;
              }
            },
            selectableDimensions: [
              {
                type: "color",
                id: `enum-${idx}-col`,
                name: i18next.t(
                  "models.tableStyling.dimensions.enumColor.name"
                ),
                value: enumCol.color,
                setDimensionValue: (stratumId, value) => {
                  this.colorSchemeType = "custom-qualitative";
                  this.setEnumColorTrait(stratumId, idx, enumCol.value, value);
                }
              },
              {
                type: "select",
                id: `enum-${idx}-value`,
                name: i18next.t(
                  "models.tableStyling.dimensions.enumValue.name"
                ),
                selectedId: enumCol.value,
                // Find unique column values which don't already have an enumCol
                // We prepend the current enumCol.value
                options: [
                  { id: enumCol.value },
                  ...(this.tableStyle.colorColumn?.uniqueValues.values
                    ?.filter(
                      (value) =>
                        !this.tableStyle.tableColorMap.enumColors.find(
                          (enumCol) => enumCol.value === value
                        )
                    )
                    .map((id) => ({ id })) ?? [])
                ],
                setDimensionValue: (stratumId, value) => {
                  this.colorSchemeType = "custom-qualitative";
                  this.setEnumColorTrait(stratumId, idx, value, enumCol.color);
                }
              },
              {
                type: "button",
                id: `enum-${idx}-remove`,
                value: i18next.t(
                  "models.tableStyling.dimensions.enumRemove.value"
                ),
                setDimensionValue: (stratumId) => {
                  this.colorSchemeType = "custom-qualitative";
                  // Remove element by clearing `value`
                  this.setEnumColorTrait(stratumId, idx, undefined, undefined);
                }
              }
            ]
          };
          return dims;
        }),

        // Are there more colors to add (are there more unique values in the column than enumCols)
        // Create "Add" to user can add more
        this.tableStyle.colorColumn &&
        this.tableStyle.tableColorMap.enumColors.filter((col) => col.value)
          .length < this.tableStyle.colorColumn?.uniqueValues.values.length
          ? {
              type: "button",
              id: `enum-add`,
              value: i18next.t("models.tableStyling.dimensions.enumAdd.value"),
              setDimensionValue: (stratumId) => {
                this.colorSchemeType = "custom-qualitative";
                const firstValue =
                  this.tableStyle.colorColumn?.uniqueValues.values.find(
                    (value) =>
                      !this.tableStyle.tableColorMap.enumColors.find(
                        (col) => col.value === value
                      )
                  );
                if (!isDefined(firstValue)) return;

                // Can we find any unused colors in the colorPalette
                const unusedColor = this.tableStyle.tableColorMap
                  .colorScaleCategorical(
                    this.tableStyle.tableColorMap.enumColors.length + 1
                  )
                  .find(
                    (col) =>
                      !this.tableStyle.tableColorMap.enumColors.find(
                        (enumColor) => enumColor.color === col
                      )
                  );

                this.setEnumColorTrait(
                  stratumId,
                  this.tableStyle.tableColorMap.enumColors.length,
                  firstValue,
                  unusedColor ?? "#000000"
                );

                this.openBinIndex.set(
                  "fill",
                  this.tableStyle.tableColorMap.enumColors.length - 1
                );
              }
            }
          : undefined
      ])
    };
  }

  @computed get nullColorDimension(): SelectableDimensionColor {
    return {
      type: "color",
      id: `null-col`,
      name: i18next.t("models.tableStyling.dimensions.nullColor.name"),
      value: this.tableStyle.colorTraits.nullColor,
      allowUndefined: true,
      setDimensionValue: (stratumId, value) => {
        this.getTableStyleTraits(stratumId)?.color.setTrait(
          stratumId,
          "nullColor",
          value
        );
      }
    };
  }

  @computed get outlierColorDimension(): SelectableDimensionColor {
    return {
      type: "color",
      id: `outlier-col`,
      name: i18next.t("models.tableStyling.dimensions.outlierColor.name"),
      allowUndefined: true,
      value:
        this.tableStyle.colorTraits.outlierColor ??
        this.tableStyle.tableColorMap.outlierColor?.toCssHexString(),
      setDimensionValue: (stratumId, value) => {
        this.getTableStyleTraits(stratumId)?.color.setTrait(
          stratumId,
          "outlierColor",
          value
        );
      }
    };
  }

  /** Misc table style color dimensions:
   * - Region color
   * - Null color
   * - Outlier color
   */
  @computed get additionalColorDimensions(): SelectableDimensionGroup {
    return {
      type: "group",
      id: "additional-colors",
      name: i18next.t("models.tableStyling.dimensions.additionalColors.name"),
      // Open group by default is no activeStyle is selected
      isOpen: !this.item.activeStyle || this.colorSchemeType === "no-style",
      selectableDimensions: filterOutUndefined([
        this.tableStyle.colorColumn?.type === TableColumnType.region
          ? {
              type: "color",
              id: `region-col`,
              name: i18next.t(
                "models.tableStyling.dimensions.regionColor.name"
              ),
              value: this.tableStyle.colorTraits.regionColor,
              allowUndefined: true,
              setDimensionValue: (stratumId, value) => {
                this.getTableStyleTraits(stratumId)?.color.setTrait(
                  stratumId,
                  "regionColor",
                  value
                );
              }
            }
          : {
              type: "color",
              id: `null-col`,
              name: i18next.t("models.tableStyling.dimensions.nullColor.name"),
              value: this.tableStyle.colorTraits.nullColor,
              allowUndefined: true,
              setDimensionValue: (stratumId, value) => {
                this.getTableStyleTraits(stratumId)?.color.setTrait(
                  stratumId,
                  "nullColor",
                  value
                );
              }
            },
        this.tableStyle.colorColumn?.type === TableColumnType.scalar
          ? {
              type: "color",
              id: `outlier-col`,
              name: i18next.t(
                "models.tableStyling.dimensions.outlierColor.name"
              ),
              allowUndefined: true,
              value:
                this.tableStyle.colorTraits.outlierColor ??
                this.tableStyle.tableColorMap.outlierColor?.toCssHexString(),
              setDimensionValue: (stratumId, value) => {
                this.getTableStyleTraits(stratumId)?.color.setTrait(
                  stratumId,
                  "outlierColor",
                  value
                );
              }
            }
          : undefined
      ])
    };
  }

  @computed get pointSizeDimensions(): SelectableDimensionGroup {
    return {
      type: "group",
      id: "point-size",
      name: i18next.t("models.tableStyling.dimensions.pointSize.name"),
      isOpen: true,
      selectableDimensions: [
        {
          type: "select",
          id: `point-size-column`,
          name: i18next.t(
            "models.tableStyling.dimensions.pointSizeColumn.name"
          ),
          selectedId: this.tableStyle.pointSizeTraits.pointSizeColumn,
          options: this.item.tableColumns
            .filter((col) => col.type === TableColumnType.scalar)
            .map((col) => ({
              id: col.name,
              name: col.title
            })),
          allowUndefined: true,
          setDimensionValue: (stratumId, value) => {
            this.getTableStyleTraits(stratumId)?.pointSize.setTrait(
              stratumId,
              "pointSizeColumn",
              value
            );
          }
        },
        ...((this.tableStyle.pointSizeColumn
          ? [
              {
                type: "numeric",
                id: "point-size-null",
                name: i18next.t(
                  "models.tableStyling.dimensions.pointSizeNull.name"
                ),
                min: 0,
                value: this.tableStyle.pointSizeTraits.nullSize,
                setDimensionValue: (stratumId, value) => {
                  this.getTableStyleTraits(stratumId)?.pointSize.setTrait(
                    stratumId,
                    "nullSize",
                    value
                  );
                }
              },
              {
                type: "numeric",
                id: "point-sizes-factor",
                name: i18next.t(
                  "models.tableStyling.dimensions.pointSizeFactor.name"
                ),
                min: 0,
                value: this.tableStyle.pointSizeTraits.sizeFactor,
                setDimensionValue: (stratumId, value) => {
                  this.getTableStyleTraits(stratumId)?.pointSize.setTrait(
                    stratumId,
                    "sizeFactor",
                    value
                  );
                }
              },
              {
                type: "numeric",
                id: "point-size-offset",
                name: i18next.t(
                  "models.tableStyling.dimensions.pointSizeOffset.name"
                ),
                min: 0,
                value: this.tableStyle.pointSizeTraits.sizeOffset,
                setDimensionValue: (stratumId, value) => {
                  this.getTableStyleTraits(stratumId)?.pointSize.setTrait(
                    stratumId,
                    "sizeOffset",
                    value
                  );
                }
              }
            ]
          : []) as SelectableDimensionNumeric[])
      ]
    };
  }

  /** Advanced region mapping - pulled from TableMixin.regionColumnDimensions and TableMixin.regionProviderDimensions
   */
  @computed
  get advancedRegionMappingDimensions(): SelectableDimensionWorkflowGroup {
    return {
      type: "group",
      id: "region-mapping",
      name: i18next.t("models.tableStyling.dimensions.regionMapping.name"),
      isOpen: false,
      selectableDimensions: filterOutUndefined([
        this.item.regionColumnDimensions,
        this.item.regionProviderDimensions
      ])
    };
  }

  /** Advanced table dimensions:
   * - Legend title
   * - Legend ticks
   * - Legend item titles
   * - Show disable style option
   * - Show disable time option
   * - Enable manual region mapping
   * - Table Column Title
   * - Table Column Units
   */
  @computed
  get advancedTableDimensions(): SelectableDimensionWorkflowGroup[] {
    return [
      {
        type: "group",
        id: "legend",
        name: i18next.t("models.tableStyling.dimensions.legend.name"),
        isOpen: false,
        selectableDimensions: filterOutUndefined([
          {
            type: "text",
            id: "legend-title",
            name: i18next.t("models.tableStyling.dimensions.legendTitle.name"),
            value: this.tableStyle.colorTraits.legend.title,
            setDimensionValue: (stratumId, value) => {
              this.getTableStyleTraits(stratumId)?.color.legend.setTrait(
                stratumId,
                "title",
                value
              );
            }
          },
          this.colorSchemeType === "diverging-continuous" ||
          this.colorSchemeType === "sequential-continuous"
            ? {
                type: "numeric",
                id: "legend-ticks",
                name: i18next.t(
                  "models.tableStyling.dimensions.legendTicks.name"
                ),
                min: 2,
                value: this.tableStyle.colorTraits.legendTicks,
                setDimensionValue: (stratumId, value) => {
                  this.getTableStyleTraits(stratumId)?.color.setTrait(
                    stratumId,
                    "legendTicks",
                    value
                  );
                }
              }
            : undefined,

          ...this.tableStyle.colorTraits.legend.items.map(
            (legendItem, idx) =>
              ({
                type: "text",
                id: `legend-${idx}-title`,
                name: i18next.t(
                  "models.tableStyling.dimensions.legendItemTitle.name",
                  { index: idx + 1 }
                ),
                value: legendItem.title,
                setDimensionValue: (stratumId, value) => {
                  legendItem.setTrait(stratumId, "title", value);
                }
              } as SelectableDimensionText)
          )
        ])
      },
      {
        type: "group",
        id: "table",
        name: i18next.t("models.tableStyling.dimensions.table.name"),
        isOpen: false,
        selectableDimensions: filterOutUndefined([
          {
            type: "checkbox",
            id: "showDisableStyleOption",
            name: i18next.t(
              "models.tableStyling.dimensions.showDisableStyleOption.name"
            ),
            options: [{ id: "true" }, { id: "false" }],
            selectedId: this.item.showDisableStyleOption ? "true" : "false",
            setDimensionValue: (stratumId, value) => {
              this.item.setTrait(
                stratumId,
                "showDisableStyleOption",
                value === "true"
              );
            }
          },
          {
            type: "checkbox",
            id: "showDisableTimeOption",
            name: i18next.t(
              "models.tableStyling.dimensions.showDisableTimeOption.name"
            ),
            options: [{ id: "true" }, { id: "false" }],
            selectedId: this.item.showDisableTimeOption ? "true" : "false",
            setDimensionValue: (stratumId, value) => {
              this.item.setTrait(
                stratumId,
                "showDisableTimeOption",
                value === "true"
              );
            }
          },
          {
            type: "checkbox",
            id: "enableManualRegionMapping",
            name: i18next.t(
              "models.tableStyling.dimensions.enableManualRegionMapping.name"
            ),
            options: [{ id: "true" }, { id: "false" }],
            selectedId: this.item.enableManualRegionMapping ? "true" : "false",
            setDimensionValue: (stratumId, value) => {
              this.item.setTrait(
                stratumId,
                "enableManualRegionMapping",
                value === "true"
              );
            }
          }
        ])
      },
      {
        type: "group",
        id: "variable-and-column",
        name: i18next.t(
          "models.tableStyling.dimensions.variableAndColumn.name"
        ),
        isOpen: false,
        selectableDimensions: filterOutUndefined([
          {
            type: "text",
            id: "column-title",
            name: i18next.t("models.tableStyling.dimensions.columnTitle.name"),
            value: this.tableStyle.colorColumn?.title,
            setDimensionValue: (stratumId, value) => {
              this.getTableColumnTraits(stratumId)?.setTrait(
                stratumId,
                "title",
                value
              );
            }
          },
          {
            type: "text",
            id: "column-units",
            name: i18next.t("models.tableStyling.dimensions.columnUnits.name"),
            value: this.tableStyle.colorColumn?.units,
            setDimensionValue: (stratumId, value) => {
              this.getTableColumnTraits(stratumId)?.setTrait(
                stratumId,
                "units",
                value
              );
            }
          }
        ])
      }
    ];
  }

  getStyleDims<T extends ModelTraits>(
    key: StyleType,
    tableStyleMap: TableStyleMap<T>,
    getDims: (
      id: string,
      pointTraits: Model<T>,
      nullValues: T
    ) => FlatSelectableDimension[],
    getPreview: (point: T, nullValues: T, label: string) => string
  ): SelectableDimensionWorkflowGroup[] {
    const traits = tableStyleMap.commonTraits;
    if (!isDefined(traits)) return [];
    return filterOutUndefined([
      {
        type: "group",
        id: "marker-style",
        name: i18next.t("models.tableStyling.dimensions.markerStyle.name"),
        isOpen: true,
        selectableDimensions: filterOutUndefined([
          {
            type: "select",
            id: "table-style",
            name: i18next.t("models.tableStyling.dimensions.tableStyle.name"),
            selectedId: tableStyleMap.column?.name,
            allowUndefined: true,
            options: this.item.tableColumns.map((col) => ({
              id: col.name,
              name: col.title
            })),
            setDimensionValue: (stratumId, value) => {
              tableStyleMap.commonTraits.setTrait(stratumId, "column", value);
            }
          },
          tableStyleMap.column
            ? {
                type: "select",
                id: "type",
                name: i18next.t(
                  "models.tableStyling.dimensions.tableStyleType.name"
                ),
                undefinedLabel: i18next.t(
                  "models.tableStyling.dimensions.tableStyleType.undefinedLabel"
                ),
                options: filterOutUndefined([
                  {
                    id: "constant",
                    name: i18next.t(
                      "models.tableStyling.dimensions.tableStyleType.constant"
                    )
                  },
                  tableStyleMap.column.type === TableColumnType.scalar
                    ? {
                        id: "bin",
                        name: i18next.t(
                          "models.tableStyling.dimensions.tableStyleType.bin"
                        )
                      }
                    : undefined,
                  {
                    id: "enum",
                    name: i18next.t(
                      "models.tableStyling.dimensions.tableStyleType.enum"
                    )
                  }
                ]),
                selectedId: traits.mapType ?? tableStyleMap.styleMap.type,
                setDimensionValue: (stratumId, id) => {
                  if (id === "bin" || id === "enum" || id === "constant")
                    traits.setTrait(stratumId, "mapType", id);
                }
              }
            : undefined
        ])
      },

      tableStyleMap.column &&
      (traits.mapType ?? tableStyleMap.styleMap.type) === "enum"
        ? {
            type: "group",
            id: "enum-styles",
            name: i18next.t("models.tableStyling.dimensions.enumStyles.name"),
            isOpen: true,
            selectableDimensions: filterOutUndefined([
              ...traits.enum?.map((enumPoint, idx) => {
                const dims: SelectableDimensionGroup = {
                  type: "group",
                  id: `${key}-enum-${idx}`,
                  name: getPreview(
                    tableStyleMap.traitValues.enum[idx],
                    tableStyleMap.traitValues.null,
                    tableStyleMap.commonTraits.enum[idx].value ??
                      i18next.t(
                        "models.tableStyling.dimensions.enumStyleItem.noValue"
                      )
                  ),
                  isOpen: this.openBinIndex.get(key) === idx,
                  onToggle: (open) => {
                    if (open && this.openBinIndex.get(key) !== idx) {
                      runInAction(() => this.openBinIndex.set(key, idx));
                      return true;
                    }
                  },
                  selectableDimensions: [
                    {
                      type: "select",
                      id: `${key}-enum-${idx}-value`,
                      name: i18next.t(
                        "models.tableStyling.dimensions.enumStyleValue.name"
                      ),
                      selectedId: enumPoint.value ?? undefined,
                      // Find unique column values which don't already have an enumCol
                      // We prepend the current enumCol.value
                      options: filterOutUndefined([
                        enumPoint.value ? { id: enumPoint.value } : undefined,
                        ...(tableStyleMap.column?.uniqueValues.values
                          ?.filter(
                            (value) =>
                              !traits.enum.find(
                                (enumCol) => enumCol.value === value
                              )
                          )
                          .map((id) => ({ id })) ?? [])
                      ]),
                      setDimensionValue: (stratumId, value) => {
                        enumPoint.setTrait(stratumId, "value", value);
                      }
                    },
                    ...getDims(
                      `${key}-enum-${idx}`,
                      tableStyleMap.traits.enum[idx] as any,
                      tableStyleMap.traitValues.null
                    ),

                    {
                      type: "button",
                      id: `${key}-enum-${idx}-remove`,
                      value: i18next.t(
                        "models.tableStyling.dimensions.enumStyleRemove.value"
                      ),
                      setDimensionValue: (stratumId) => {
                        enumPoint.setTrait(stratumId, "value", null);
                      }
                    }
                  ]
                };
                return dims;
              }),
              // Are there more colors to add (are there more unique values in the column than enumCols)
              // Create "Add" to user can add more

              tableStyleMap.column?.uniqueValues.values.filter(
                (v) => !traits.enum?.find((col) => col.value === v)
              ).length > 0
                ? ({
                    type: "button",
                    id: `${key}-enum-add`,
                    value: i18next.t(
                      "models.tableStyling.dimensions.enumStyleAdd.value"
                    ),
                    setDimensionValue: (stratumId) => {
                      const firstValue =
                        tableStyleMap.column?.uniqueValues.values.find(
                          (value) =>
                            !traits.enum?.find((col) => col.value === value)
                        );
                      if (!isDefined(firstValue)) return;

                      traits
                        .addObject(stratumId, "enum")
                        ?.setTrait(stratumId, "value", firstValue);

                      this.openBinIndex.set(key, traits.enum.length - 1);
                    }
                  } as SelectableDimensionButton)
                : undefined
            ])
          }
        : undefined,
      tableStyleMap.column &&
      (traits.mapType ?? tableStyleMap.styleMap.type) === "bin"
        ? {
            type: "group",
            id: "bin-styles",
            name: i18next.t("models.tableStyling.dimensions.binStyles.name"),
            isOpen: true,
            selectableDimensions: filterOutUndefined([
              {
                type: "button",
                id: `${key}-bin-add`,
                value: i18next.t(
                  "models.tableStyling.dimensions.binStyleAdd.value"
                ),
                setDimensionValue: (stratumId) => {
                  traits.addObject(stratumId, "bin");
                  this.openBinIndex.set(key, traits.bin.length - 1);
                }
              } as SelectableDimensionButton,
              ...traits.bin
                .map((bin, idx) => {
                  const dims: SelectableDimensionGroup = {
                    type: "group",
                    id: `${key}-bin-${idx}`,
                    name: getPreview(
                      tableStyleMap.traitValues.bin[idx],
                      tableStyleMap.traitValues.null,
                      !isDefined(bin.maxValue ?? undefined)
                        ? i18next.t(
                            "models.tableStyling.dimensions.binStyleItem.noValue"
                          )
                        : idx > 0 &&
                          isDefined(traits.bin[idx - 1].maxValue ?? undefined)
                        ? i18next.t(
                            "models.tableStyling.dimensions.binStyleItem.range",
                            {
                              value1: traits.bin[idx - 1].maxValue,
                              value2: bin.maxValue
                            }
                          )
                        : `${bin.maxValue}`
                    ),

                    isOpen: this.openBinIndex.get(key) === idx,
                    onToggle: (open) => {
                      if (open && this.openBinIndex.get(key) !== idx) {
                        runInAction(() => this.openBinIndex.set(key, idx));
                        return true;
                      }
                    },
                    selectableDimensions: filterOutUndefined([
                      idx > 0
                        ? {
                            type: "numeric",
                            id: `${key}-bin-${idx}-start`,
                            name: i18next.t(
                              "models.tableStyling.dimensions.binStyleStart.name"
                            ),
                            value: traits.bin[idx - 1].maxValue ?? undefined,
                            setDimensionValue: (stratumId, value) => {
                              traits.bin[idx - 1].setTrait(
                                stratumId,
                                "maxValue",
                                value
                              );
                            }
                          }
                        : undefined,
                      {
                        type: "numeric",
                        id: `${key}-bin-${idx}-stop`,
                        name: i18next.t(
                          "models.tableStyling.dimensions.binStyleStop.name"
                        ),
                        value: bin.maxValue ?? undefined,
                        setDimensionValue: (stratumId, value) => {
                          bin.setTrait(stratumId, "maxValue", value);
                        }
                      },
                      ...getDims(
                        `${key}-bin-${idx}`,
                        tableStyleMap.traits.bin[idx] as any,
                        tableStyleMap.traitValues.null
                      ),
                      {
                        type: "button",
                        id: `${key}-bin-${idx}-remove`,
                        value: i18next.t(
                          "models.tableStyling.dimensions.binStyleRemove.value"
                        ),
                        setDimensionValue: (stratumId) => {
                          bin.setTrait(stratumId, "maxValue", null);
                        }
                      }
                    ])
                  };
                  return dims;
                })
                .reverse() // Reverse to match legend order
            ])
          }
        : undefined,
      {
        type: "group",
        id: `${key}-null`,
        name: i18next.t("models.tableStyling.dimensions.binStyleNull.name"),
        isOpen:
          !tableStyleMap.column ||
          !traits.mapType ||
          traits.mapType === "constant",
        selectableDimensions: getDims(
          `${key}-null`,
          tableStyleMap.traits.null as any,
          tableStyleMap.traitValues.null
        )
      }
    ]);
  }

  @computed get markerDims(): SelectableDimensionWorkflowGroup[] {
    return this.getStyleDims(
      "point",
      this.tableStyle.pointStyleMap,
      (id, pointTraits, nullValues) =>
        filterOutUndefined([
          {
            type: "select",
            id: `${id}-marker`,
            name: i18next.t("models.tableStyling.dimensions.marker.name"),
            selectedId: (pointTraits.marker ?? nullValues.marker) || "point",
            allowUndefined: true,
            allowCustomInput: true,
            options: [...allIcons, "point"].map((icon) => ({
              id: icon
            })),
            optionRenderer: MarkerOptionRenderer,
            setDimensionValue: (stratumId, value) => {
              pointTraits.setTrait(stratumId, "marker", value || "point");
            }
          },
          {
            type: "numeric",
            id: `${id}-rotation`,
            name: i18next.t(
              "models.tableStyling.dimensions.markerRotation.name"
            ),
            value: pointTraits.rotation ?? nullValues.rotation,
            setDimensionValue: (stratumId, value) => {
              pointTraits.setTrait(stratumId, "rotation", value);
            }
          },
          !this.tableStyle.pointSizeColumn
            ? {
                type: "numeric",
                id: `${id}-height`,
                name: i18next.t(
                  "models.tableStyling.dimensions.markerHeight.name"
                ),
                value: pointTraits.height ?? nullValues.height,
                setDimensionValue: (stratumId, value) => {
                  pointTraits.setTrait(stratumId, "height", value);
                }
              }
            : undefined,
          !this.tableStyle.pointSizeColumn
            ? {
                type: "numeric",
                id: `${id}-width`,
                name: i18next.t(
                  "models.tableStyling.dimensions.markerWidth.name"
                ),
                value: pointTraits.width ?? nullValues.width,
                setDimensionValue: (stratumId, value) => {
                  pointTraits.setTrait(stratumId, "width", value);
                }
              }
            : undefined
        ]),
      (point, nullValue, label) =>
        `<div><img height="${24}px" style="margin-bottom: -4px; transform: rotate(${
          point.rotation ?? 0
        }deg)" src="${
          getMakiIcon(
            point.marker ?? nullValue.marker,
            "#fff",
            1,
            "#000",
            24,
            24
          ) ?? point.marker
        }"></img> ${label}</div>`
    );
  }

  @computed get outlineDims(): SelectableDimensionWorkflowGroup[] {
    return this.getStyleDims(
      "outline",
      this.tableStyle.outlineStyleMap,
      (id, outlineTraits, nullValues) => [
        {
          type: "color",
          id: `${id}-color`,
          name: i18next.t("models.tableStyling.dimensions.outlineColor.name"),
          allowUndefined: true,
          value: outlineTraits.color ?? nullValues.color,
          setDimensionValue: (stratumId, value) => {
            outlineTraits.setTrait(stratumId, "color", value);
          }
        },
        {
          type: "numeric",
          id: `${id}-width`,
          name: i18next.t("models.tableStyling.dimensions.outlineWidth.name"),
          value: outlineTraits.width ?? nullValues.width,
          setDimensionValue: (stratumId, value) => {
            outlineTraits.setTrait(stratumId, "width", value);
          }
        }
      ],
      (outline, nullValue, label) =>
        getColorPreview(outline.color ?? nullValue.color ?? "#aaa", label)
    );
  }

  @computed get fillStyleDimensions(): SelectableDimensionWorkflowGroup[] {
    return filterOutUndefined([
      // Only show color scheme selection if activeStyle exists
      this.item.activeStyle ? this.colorSchemeSelectableDim : undefined,

      // If we are in continuous realm:
      // - Display range
      this.colorSchemeType === "sequential-continuous" ||
      this.colorSchemeType === "diverging-continuous"
        ? this.displayRangeDim
        : undefined,
      // If we are in discrete realm:
      // - Bin maximums
      this.colorSchemeType === "sequential-discrete" ||
      this.colorSchemeType === "diverging-discrete" ||
      this.colorSchemeType === "custom-discrete"
        ? this.binColorDims
        : undefined,
      // If we are in qualitative realm
      this.colorSchemeType === "qualitative" ||
      this.colorSchemeType === "custom-qualitative"
        ? this.enumColorDims
        : undefined,

      this.additionalColorDimensions
    ]);
  }

  /** All of the dimensions! */
  @computed get selectableDimensions(): SelectableDimensionWorkflowGroup[] {
    return filterOutUndefined([
      this.tableStyleSelectableDim,

      ...(this.styleType === "fill" ? this.fillStyleDimensions : []),
      ...(this.styleType === "point" ? this.markerDims : []),
      ...(this.styleType === "outline" ? this.outlineDims : []),
      this.styleType === "point-size" ? this.pointSizeDimensions : undefined,

      // Show region mapping dimensions if using region column and showing advanced options
      this.showAdvancedOptions &&
      this.styleType === "fill" &&
      this.tableStyle.colorColumn?.type === TableColumnType.region
        ? this.advancedRegionMappingDimensions
        : undefined,

      // Show advanced table options
      ...(this.showAdvancedOptions ? this.advancedTableDimensions : [])
    ]);
  }

  /**
   * Set `TableColorStyleTraits.binMaximums`
   *
   * If the maximum value of the dataset is greater than the last value in this array, an additional bin is added automatically (See `TableColorStyleTraits.binMaximums`)
   * Because of this, we may need to update `maximumValue` so we don't get more bins added automatically
   */
  setBinMaximums(stratumId: string, binMaximums?: number[]) {
    if (!binMaximums)
      binMaximums = [...this.tableStyle.tableColorMap.binMaximums];
    const colorTraits = this.getTableStyleTraits(stratumId)?.color;
    if (
      binMaximums[binMaximums.length - 1] !==
      this.tableStyle.tableColorMap.maximumValue
    ) {
      colorTraits?.setTrait(
        stratumId,
        "maximumValue",
        binMaximums[binMaximums.length - 1]
      );
    }
    colorTraits?.setTrait(stratumId, "binMaximums", binMaximums);
  }

  /** Clear binMaximums (which will automatically generate new ones based on numberOfBins, minimumValue and maximumValue).
   * Then set them have a sensible precision (otherwise there will be way too many digits).
   * This will also clear `minimumValue` and `maximumValue` */
  resetBinMaximums(stratumId: string) {
    this.getTableStyleTraits(stratumId)?.color.setTrait(
      stratumId,
      "minimumValue",
      undefined
    );
    this.getTableStyleTraits(stratumId)?.color.setTrait(
      stratumId,
      "maximumValue",
      undefined
    );
    this.getTableStyleTraits(stratumId)?.color.setTrait(
      stratumId,
      "binMaximums",
      undefined
    );
    const binMaximums = this.tableStyle.tableColorMap.binMaximums.map((bin) =>
      parseFloat(
        bin.toFixed(this.tableStyle.numberFormatOptions?.maximumFractionDigits)
      )
    );
    this.getTableStyleTraits(stratumId)?.color.setTrait(
      stratumId,
      "binMaximums",
      binMaximums
    );
  }

  /** Set enum value and color for specific index in `enumColors` array */
  setEnumColorTrait(
    stratumId: string,
    index: number,
    value?: string,
    color?: string
  ) {
    const enumColors = this.tableStyle.colorTraits.traits.enumColors.toJson(
      this.tableStyle.tableColorMap.enumColors
    ) as ModelPropertiesFromTraits<EnumColorTraits>[];

    // Remove element if value and color are undefined
    if (!isDefined(value) && !isDefined(color)) enumColors.splice(index, 1);
    else enumColors[index] = { value, color };

    this.getTableStyleTraits(stratumId)?.color.setTrait(
      stratumId,
      "enumColors",
      enumColors
    );
  }

  /** Convenience getter for item.activeTableStyle */
  @computed get tableStyle() {
    return this.item.activeTableStyle;
  }

  /** Get `TableStyleTraits` for the active table style (so we can call `setTraits`).
   */
  getTableStyleTraits(stratumId: string, id: string = this.tableStyle.id) {
    if (id === "Default Style") {
      id = "User Style";
      runInAction(() =>
        this.item.setTrait(stratumId, "activeStyle", "User Style")
      );
    }

    const style =
      this.item.styles?.find((style) => style.id === id) ??
      this.item.addObject(stratumId, "styles", id);

    style?.setTrait(stratumId, "hidden", false);

    return style;
  }

  /** Get `TableColumnTraits` for the active table style `colorColumn` (so we can call `setTraits`) */
  getTableColumnTraits(stratumId: string) {
    if (!this.tableStyle.colorColumn?.name) return;
    return (
      this.item.columns?.find(
        (col) => col.name === this.tableStyle.colorColumn!.name
      ) ??
      this.item.addObject(
        stratumId,
        "columns",
        this.tableStyle.colorColumn.name
      )
    );
  }
}

function getColorPreview(col: string, label: string) {
  return `<div><div style="margin-bottom: -4px; width:20px; height:20px; display:inline-block; background-color:${col} ;"></div> ${label}</div>`;
}
