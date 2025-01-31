import i18next from "i18next";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import BoundingSphere from "terriajs-cesium/Source/Core/BoundingSphere";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import DataSource from "terriajs-cesium/Source/DataSources/DataSource";
import Property from "terriajs-cesium/Source/DataSources/Property";
import PropertyBag from "terriajs-cesium/Source/DataSources/PropertyBag";
import ItemSearchProvider, {
  ItemSearchParameter,
  ItemSearchResult
} from "./ItemSearchProvider";
import { BaseModel } from "../Definition/Model";
import { SearchParameterTraits } from "../../Traits/TraitsClasses/SearchableItemTraits";
import MappableMixin, { isDataSource } from "../../ModelMixins/MappableMixin";
import { isJsonNumber, isJsonObject, isJsonString } from "../../Core/Json";
import isDefined from "../../Core/isDefined";
import collectPositions from "./collectPositions";

interface QueryOptions {
  columnSearch?: boolean;
  globalSearch?: boolean;
  forceIncludeInResult?: boolean;
}

type WithQueryOptions<T> = T extends infer U
  ? Omit<U, "queryOptions"> & { queryOptions: QueryOptions }
  : never;

type DataSourceParameterOption = Required<
  WithQueryOptions<SearchParameterTraits>
>;

interface UntypedColumn<T = unknown> {
  id: string;
  name: string;
  queryOptions: QueryOptions;
  values: (T | null | undefined)[];
}

interface TextColumn extends UntypedColumn<string> {
  type: "text";
}

interface NumericColumn extends UntypedColumn<number> {
  type: "numeric";
  range: { min: number; max: number };
}

type TypedColumn = TextColumn | NumericColumn;

/** Represents a match to a single property. */
interface PropertyMatch {
  matchType: "GLOBAL" | "COLUMN" | "FORCE";
  column: TypedColumn;
  value: unknown;
}

/** A collection of matched property values and their metadata within a single feature. */
type FeatureMatch = PropertyMatch[];

/** Represents match statuses for the data source. */
type IntermediateSearchResult = (FeatureMatch | undefined)[];

const GLOBAL_SEARCH_PARAMETER_ID = "__ALL__";
const NAME_SEARCH_PARAMETER_ID = "__NAME__";
const DESCRIPTION_SEARCH_PARAMETER_ID = "__DESCRIPTION__";

/** An ItemSearchProvider that searches DataSource for a property value.
 *
 * Capable of performing a global search or a per-column search or both, depending on the configuration.
 *
 * By default performs a global search on all string properties.
 * If `ItemSearchTraits.parameters` are specified, performs both global and per-column search
 * on the specified properties.
 *
 * The search behavior can be customized even futrher by specifying `SearchParameterTraits.queryOptions`:
 *
 * * `queryOptions.globalSearch`: Use this column for the global search. Defaults to true.
 * * `queryOptions.columnSearch`: Use this column for the per-column search. Defaults to true.
 * * `queryOptions.forceIncludeInResult`: Always include this column in the search result. Defaults to false.
 *
 * In `ItemSearchTraits.resultTemplate` a property named `entries` is available,
 * which is an array of objects of the following shape:
 * `{ id: <property name>, name: <display name>, value: <property value> }`.
 * Template authors may use this property to write a generic template that can be re-used across
 * datasets with different property structures.
 *
 * Example configuration:
 *
 * ```json
 *   {
 *     "id": "search-test",
 *     "type": "geojson",
 *     "url": "...",
 *     "search": {
 *       "providerType": "data-source",
 *       "parameters": [
 *         {
 *           "id": "facility_name",
 *           "name": "Facility Name",
 *           "queryOptions": {
 *             "globalSearch": false,
 *             "columnSearch": false,
 *             "forceIncludeInResult": true
 *           }
 *         },
 *       ],
 *       "resultTemplate": "{{#entries}}{{name}}: {{value}}{{/entries}}"
 *     }
 *   }
 * ```
 * */
class DataSourceItemSearchProvider extends ItemSearchProvider {
  private dataSource: DataSource | undefined;
  private columns: TypedColumn[] = [];

  /**
   * If parameter
   * @param options defaultQueryOptions specifies the query options used when
   * @param parameterOptions
   * @param item
   */
  constructor(
    readonly options: {
      defaultQueryOptions?: QueryOptions;
    },
    readonly parameterOptions: SearchParameterTraits[],
    readonly item: BaseModel
  ) {
    super(options, parameterOptions, item);
  }
  async initialize() {
    if (!MappableMixin.isMixedInto(this.item)) return;
    (await this.item.loadMapItems()).throwIfError();
    this.dataSource = this.item.mapItems.find(isDataSource);
    if (this.dataSource)
      this.columns = buildColumns(
        this.dataSource,
        // If parameterOptions are explicitly specified, build column objects
        // only for the specified columns. Otherwise build column objects
        // for all the properties found in the Cesium entities.
        this.parameterOptions.length > 0
          ? this.parameterOptions.map(cleanSearchParameter).filter(isDefined)
          : undefined,
        cleanQueryOptions(this.options?.defaultQueryOptions, {
          columnSearch: false
        })
      );
  }

  /** Returns search parameters for use in the search UI. */
  async describeParameters() {
    let globalSearchEnabled = false;
    const columnSearchParams: ItemSearchParameter[] = [];
    this.columns.forEach(({ values, queryOptions, ...itemSearchParameter }) => {
      if (queryOptions.globalSearch) globalSearchEnabled = true;
      if (queryOptions.columnSearch)
        columnSearchParams.push(itemSearchParameter);
    });
    if (globalSearchEnabled)
      columnSearchParams.splice(0, 0, {
        id: GLOBAL_SEARCH_PARAMETER_ID,
        name: i18next.t("dataSourceItemSearchProvider.all"),
        type: "text"
      });
    return columnSearchParams;
  }

  async search(parameterValues: Map<string, any>): Promise<ItemSearchResult[]> {
    const dataSource = this.dataSource;
    if (!dataSource) return [];
    const columns = this.columns;
    const intermediateSearchResults: IntermediateSearchResult[] = [];

    // Do global search.
    const globalSearchParams = columns.filter(
      (p) => p.queryOptions.globalSearch
    );
    if (globalSearchParams.length > 0) {
      const globalSearchParamValue = parameterValues.get(
        GLOBAL_SEARCH_PARAMETER_ID
      );
      if (globalSearchParamValue) {
        intermediateSearchResults.push(
          globalSearchParams
            .map((column) => {
              const columnSearchResults = searchInColumn(
                column,
                globalSearchParamValue,
                "GLOBAL"
              );
              return columnSearchResults;
            })
            .reduce<IntermediateSearchResult>((acc, cur) => {
              // Merge IntermediateSearchResults by ORing them together.
              if (cur != null)
                for (let i = 0; i < acc.length; i += 1) {
                  const c = cur[i];
                  if (c == undefined) continue;
                  if (acc[i] == undefined) acc[i] = [];
                  const a = acc[i] ?? (acc[i] = []);
                  a.push(...c);
                }
              return acc;
            }, new Array(dataSource.entities.values.length))
        );
      }
    }

    // Do per-column search.
    intermediateSearchResults.push(
      ...columns
        .map((column) => {
          const parameterValue = parameterValues.get(column.id);
          if (!parameterValue) return null;
          const columnSearchResults = searchInColumn(
            column,
            parameterValue,
            "COLUMN"
          );
          return columnSearchResults;
        })
        .filter(isDefined)
    );

    if (intermediateSearchResults.length === 0) return [];

    // Handle properties marked as "forceIncludeInResult".
    // Prepend such properties to the search result.
    intermediateSearchResults.splice(
      0,
      0,
      ...columns
        .filter((column) => column.queryOptions.forceIncludeInResult)
        .map((column) => {
          const intermediateSearchResult: IntermediateSearchResult =
            column.values.map((value) => [
              {
                matchType: "FORCE",
                column,
                value
              }
            ]);
          return intermediateSearchResult;
        })
        .filter(isDefined)
    );

    // Merge global search result and search results from each column by ANDing them together.
    const mergedSearchResults: IntermediateSearchResult =
      intermediateSearchResults.reduce((acc, cur) => {
        for (let i = 0; i < acc.length; i += 1) {
          const c = cur[i];
          if (c == undefined) acc[i] = undefined;
          else if (acc[i]) acc[i]?.push(...c);
        }
        return acc;
      });

    // Build ItemSearchResult objects.
    const currentTime = dataSource.clock?.currentTime;
    return mergedSearchResults
      .map((result, i) => {
        if (!result) return null;
        const entity = dataSource.entities.values[i];
        const positions = collectPositions(entity, currentTime);
        const boundingSphere = BoundingSphere.fromPoints(positions);
        const coordinate = Cartographic.fromCartesian(boundingSphere.center);
        const entries = result
          .filter(({ value, matchType, column: { queryOptions } }) => {
            if (matchType !== "FORCE" && queryOptions.forceIncludeInResult)
              // This column is already included in the search result, so filter it out.
              return false;
            if (value == null) return false;
            return true;
          })
          .map(({ value, column }) => ({
            id: column.id,
            name: column.name || column.id,
            value
          }));
        const properties = Object.fromEntries(
          entries.map(({ id, value }) => [id, value])
        );
        // Make `entries` available in `resultTemplate`.
        // This allows template authors to write a template that lists property values
        // like `{{#entries}}{{name}}: {{value}}{{/entries}}`.
        properties.entries = entries;
        const finalResult: ItemSearchResult = {
          id: i,
          featureCoordinate: {
            latitudeDegrees: CesiumMath.toDegrees(coordinate.latitude),
            longitudeDegrees: CesiumMath.toDegrees(coordinate.longitude),
            featureHeight: boundingSphere.radius / 2
          },
          properties,
          idPropertyName: ""
        };
        return finalResult;
      })
      .filter(isDefined);
  }
}

/** Similar to the built-in Map but preserves ordering. */
class OrderedMap<K, V> {
  private keys: K[] = [];
  private mapping: Map<K, V> = new Map();
  has(k: K): boolean {
    return this.mapping.has(k);
  }
  appendItem(k: K, v: V): void {
    if (!this.mapping.has(k)) this.keys.push(k);
    this.mapping.set(k, v);
  }
  prependItem(k: K, v: V): void {
    if (!this.mapping.has(k)) this.keys.splice(0, 0, k);
    this.mapping.set(k, v);
  }
  forEach(cb: (k: K, v: V) => void): void {
    this.keys.forEach((k) => cb(k, this.mapping.get(k)!));
  }
  values(): V[] {
    return this.keys.map((k) => this.mapping.get(k)!);
  }
}

const cleanQueryOptions = (
  value: unknown,
  defaults?: QueryOptions
): QueryOptions => {
  const cleaned: Required<QueryOptions> = {
    columnSearch: true,
    globalSearch: true,
    forceIncludeInResult: false,
    ...defaults
  };
  if (!isJsonObject(value)) return cleaned;
  if (typeof value.columnSearch === "boolean")
    cleaned.columnSearch = value.columnSearch;
  if (typeof value.globalSearch === "boolean")
    cleaned.globalSearch = value.globalSearch;
  if (typeof value.forceIncludeInResult === "boolean")
    cleaned.forceIncludeInResult = value.forceIncludeInResult;
  return cleaned;
};

const cleanSearchParameter = ({
  id,
  name,
  queryOptions
}: SearchParameterTraits): DataSourceParameterOption | null => {
  if (!id) return null;
  const cleanedQueryOptions = cleanQueryOptions(queryOptions);
  if (!cleanedQueryOptions) return null;
  return {
    id,
    name: name || "",
    queryOptions: cleanedQueryOptions
  };
};

const valueFromProperty = (property: Property | undefined) => {
  if (!property) return undefined;
  if (!(property instanceof ConstantProperty)) return undefined;
  return property.valueOf();
};

const valueFromProperties = (properties: PropertyBag, name: string) => {
  const property = properties[name];
  return valueFromProperty(property);
};

/** Builds column objects for the data source.
 * If parameterOptions are given, builds column objects only for properties specified in parameterOptions.
 * Otherwise builds column objects for all the properties found in the entities of the data source. */
const buildColumns = (
  dataSource: DataSource,
  parameterOptions?: DataSourceParameterOption[],
  defaultQueryOptions: QueryOptions = {
    columnSearch: false,
    globalSearch: true,
    forceIncludeInResult: false
  }
): TypedColumn[] => {
  /** Column objects for storing custom properties
   * (https://cesium.com/learn/cesiumjs/ref-doc/Entity.html#properties). */
  const untypedColumns = new OrderedMap<string, UntypedColumn>();

  /** A column object for storing entity names
   * (https://cesium.com/learn/cesiumjs/ref-doc/Entity.html#name). */
  let nameColumn: UntypedColumn | null = null;

  /** A column object for storing entity descriptions
   * (https://cesium.com/learn/cesiumjs/ref-doc/Entity.html#description). */
  let descriptionColumn: UntypedColumn | null = null;

  if (parameterOptions) {
    // Prepare empty column objects for properties specified in parameterOptions.
    parameterOptions.forEach((p) => {
      const newColumn = {
        id: p.id,
        name: p.name,
        queryOptions: p.queryOptions,
        values: []
      };
      if (p.id === NAME_SEARCH_PARAMETER_ID) nameColumn = newColumn;
      else if (p.id === DESCRIPTION_SEARCH_PARAMETER_ID)
        descriptionColumn = newColumn;
      else untypedColumns.appendItem(p.id, newColumn);
    });
  } else {
    nameColumn = {
      id: NAME_SEARCH_PARAMETER_ID,
      name: i18next.t("dataSourceItemSearchProvider.entityName"),
      queryOptions: {
        globalSearch: true,
        columnSearch: false,
        forceIncludeInResult: true
      },
      values: []
    };
    descriptionColumn = {
      id: DESCRIPTION_SEARCH_PARAMETER_ID,
      name: i18next.t("dataSourceItemSearchProvider.entityDescription"),
      queryOptions: {
        globalSearch: true,
        columnSearch: false,
        forceIncludeInResult: false
      },
      values: []
    };
  }

  const entities = dataSource.entities.values;
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (nameColumn) nameColumn.values[i] = entity.name;
    if (descriptionColumn)
      descriptionColumn.values[i] = valueFromProperty(entity.description);
    const { properties } = entity;
    if (properties) {
      if (!parameterOptions) {
        // If parameterOptions are not given, automatically create column objects.
        // Look for properties that we haven't seen yet, and create column objects
        // for such properties.
        properties.propertyNames
          .filter((name) => !untypedColumns.has(name))
          .forEach((name) => {
            untypedColumns.appendItem(name, {
              id: name,
              name,
              queryOptions: defaultQueryOptions,
              values: []
            });
          });
      }
      untypedColumns.forEach((id, column) => {
        column.values[i] = valueFromProperties(properties, column.id);
      });
    }
  }

  if (descriptionColumn)
    untypedColumns.prependItem(descriptionColumn.id, descriptionColumn);
  if (nameColumn) untypedColumns.prependItem(nameColumn.id, nameColumn);

  const typedColumns = untypedColumns
    .values()
    .map((column): TypedColumn | undefined => {
      const { values } = column;
      if (
        values.every(
          (v): v is number | null | undefined => isJsonNumber(v) || v == null
        )
      ) {
        const nonNullValues = values.filter(isDefined);
        const numericColumn: NumericColumn = {
          ...column,
          type: "numeric",
          // Turn off global search for numeric columns.
          queryOptions: { ...column.queryOptions, globalSearch: false },
          values,
          range: {
            min: Math.min(...nonNullValues),
            max: Math.max(...nonNullValues)
          }
        };
        return numericColumn;
      } else if (
        values.every(
          (v): v is string | null | undefined => isJsonString(v) || v == null
        )
      ) {
        const textColumn: TextColumn = {
          ...column,
          type: "text",
          values
        };
        return textColumn;
      }
    })
    .filter(isDefined);
  return typedColumns;
};

/** Returns an IntermediateSearchResult for a specific column. */
const searchInColumn = (
  column: TypedColumn,
  query: unknown,
  matchType: PropertyMatch["matchType"]
): IntermediateSearchResult | null => {
  switch (column.type) {
    case "text": {
      if (typeof query !== "string") return null;
      return column.values.map((value) =>
        typeof value === "string" && value.includes(query)
          ? [{ matchType, column, value }]
          : undefined
      );
    }
    case "numeric": {
      if (!isJsonObject(query)) return null;
      let start: number = -Infinity;
      let end: number = Infinity;
      if (typeof query.start === "number") start = query.start;
      if (typeof query.end === "number") end = query.end;
      return column.values.map((value) =>
        typeof value === "number" && start <= value && value <= end
          ? [{ matchType, column, value }]
          : undefined
      );
    }
  }
};

export default DataSourceItemSearchProvider;
