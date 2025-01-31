import "jasmine-ajax";
import Terria from "../../../lib/Models/Terria";
import CreateModel from "../../../lib/Models/Definition/CreateModel";
import MappableMixin, { MapItem } from "../../../lib/ModelMixins/MappableMixin";
import mixTraits from "../../../lib/Traits/mixTraits";
import MappableTraits from "../../../lib/Traits/TraitsClasses/MappableTraits";
import DataSourceItemSearchProvider from "../../../lib/Models/ItemSearchProviders/DataSourceItemSearchProvider";
import GeoJsonDataSource from "terriajs-cesium/Source/DataSources/GeoJsonDataSource";

class TestCatalogItem extends MappableMixin(
  CreateModel(mixTraits(MappableTraits))
) {
  private _dataSource: GeoJsonDataSource | undefined;
  protected async forceLoadMapItems() {
    this._dataSource = await GeoJsonDataSource.load(this.uniqueId);
  }
  get mapItems(): MapItem[] {
    return [this._dataSource].filter(
      (item): item is Exclude<typeof item, undefined> => item !== undefined
    );
  }
}

describe("DataSourceItemSearchProvider", () => {
  describe("global search", () => {
    it("performs the global search by default", async () => {
      const item = new TestCatalogItem(
        "test/GeoJSON/cemeteries.geojson",
        new Terria()
      );
      const provider = new DataSourceItemSearchProvider({}, [], item);
      await provider.initialize();
      expect(await provider.describeParameters()).toEqual([
        {
          type: "text",
          id: "__ALL__",
          name: "dataSourceItemSearchProvider.all"
        }
      ]);
      expect(await provider.search(new Map([["__ALL__", "WOOD"]]))).toEqual([
        {
          id: 40,
          featureCoordinate: {
            featureHeight: 0,
            longitudeDegrees: 145.10413,
            latitudeDegrees: -37.85326
          },
          idPropertyName: "",
          properties: {
            __NAME__: "BURWOOD CEMETERY",
            NAME: "BURWOOD CEMETERY",
            entries: [
              {
                id: "__NAME__",
                name: "dataSourceItemSearchProvider.entityName",
                value: "BURWOOD CEMETERY"
              },
              { id: "NAME", name: "NAME", value: "BURWOOD CEMETERY" }
            ]
          }
        },
        {
          id: 55,
          featureCoordinate: {
            featureHeight: 0,
            longitudeDegrees: 141.60544,
            latitudeDegrees: -37.004249999999985
          },
          idPropertyName: "",
          properties: {
            __NAME__: "HEYWOOD CEMETERY",
            NAME: "HEYWOOD CEMETERY",
            entries: [
              {
                id: "__NAME__",
                name: "dataSourceItemSearchProvider.entityName",
                value: "HEYWOOD CEMETERY"
              },
              { id: "NAME", name: "NAME", value: "HEYWOOD CEMETERY" }
            ]
          }
        }
      ]);
    });
  });
  describe("per-column search", () => {
    it("performs the per-column search of text properties", async () => {
      const item = new TestCatalogItem(
        "test/GeoJSON/gme.geojson",
        new Terria()
      );
      const provider = new DataSourceItemSearchProvider(
        {},
        [
          {
            id: "State",
            name: "State",
            queryOptions: {
              globalSearch: false,
              columnSearch: false,
              forceIncludeInResult: true
            }
          },
          { id: "Wheelchair", name: "Wheelchair" },
          { id: "Fcilty_nam", name: "Facility Name" }
        ],
        item
      );
      await provider.initialize();
      expect(await provider.describeParameters()).toEqual([
        {
          type: "text",
          id: "__ALL__",
          name: "dataSourceItemSearchProvider.all"
        },
        {
          type: "text",
          id: "Wheelchair",
          name: "Wheelchair"
        },
        {
          type: "text",
          id: "Fcilty_nam",
          name: "Facility Name"
        }
      ]);
      expect(
        await provider.search(
          new Map([
            ["Wheelchair", "YES"],
            ["Fcilty_nam", "Mt"]
          ])
        )
      ).toEqual([
        {
          id: 7,
          featureCoordinate: {
            featureHeight: 0,
            longitudeDegrees: 140.783421,
            latitudeDegrees: -37.831071
          },
          idPropertyName: "",
          properties: {
            State: "SA",
            Fcilty_nam: "Mt Gambier",
            Wheelchair: "YES",
            entries: [
              { id: "State", name: "State", value: "SA" },
              { id: "Wheelchair", name: "Wheelchair", value: "YES" },
              { id: "Fcilty_nam", name: "Facility Name", value: "Mt Gambier" }
            ]
          }
        }
      ]);
    });
    it("performs the per-column search of numeric properties", async () => {
      const item = new TestCatalogItem(
        "test/GeoJSON/cemeteries.geojson",
        new Terria()
      );
      const provider = new DataSourceItemSearchProvider(
        {},
        [
          {
            id: "OBJECTID",
            name: "ID",
            queryOptions: { columnSearch: true }
          }
        ],
        item
      );
      await provider.initialize();
      expect(await provider.describeParameters()).toEqual([
        {
          type: "numeric",
          id: "OBJECTID",
          name: "ID",
          range: { min: 1, max: 59 }
        }
      ]);
      const result = await provider.search(
        new Map([["OBJECTID", { start: 42, end: 43 }]])
      );
      expect(result.length).toEqual(2);
      expect(result[0].properties.OBJECTID).toEqual(42);
      expect(result[1].properties.OBJECTID).toEqual(43);
    });
  });
  it("does not error when no search query is provided", async () => {
    const item = new TestCatalogItem("test/GeoJSON/gme.geojson", new Terria());
    const provider = new DataSourceItemSearchProvider({}, [], item);
    await provider.initialize();
    expect(await provider.search(new Map([]))).toEqual([]);
  });
});
