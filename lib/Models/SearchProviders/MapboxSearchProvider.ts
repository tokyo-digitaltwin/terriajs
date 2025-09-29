import i18next from "i18next";
import { makeObservable, override, runInAction } from "mobx";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import {
  Category,
  SearchAction
} from "../../Core/AnalyticEvents/analyticEvents";
import { applyTranslationIfExists } from "../../Language/languageHelpers";
import LocationSearchProviderMixin from "../../ModelMixins/SearchProviders/LocationSearchProviderMixin";
import CreateModel from "../Definition/CreateModel";
import Terria from "../Terria";
import CommonStrata from "./../Definition/CommonStrata";
import SearchProviderResults from "./SearchProviderResults";
import SearchResult from "./SearchResult";
import MapboxSearchProviderTraits from "../../Traits/SearchProviders/MapboxSearchProviderTraits";
import loadJson from "../../Core/loadJson";
import { point } from "@turf/helpers";
import buffer from "@turf/buffer";
import bbox from "@turf/bbox";

interface MapboxGeocodeResultFeature {
  geometry: {type: string, coordinates: [number, number]};
  properties: { 
    bbox: [number, number, number, number],
    name: string,
    // context: {
    //   locality: { name: string},
    //   place: { name: string }, 
    //   region: { name: string }
    // }
  };
}

interface MapboxIonGeocodeResult {
  features: MapboxGeocodeResultFeature[];
}

export default class MapboxSearchProvider extends LocationSearchProviderMixin(
  CreateModel(MapboxSearchProviderTraits)
) {
  static readonly type = "mapbox-search-provider";
  
  get type() {
    return MapboxSearchProvider.type;
  }

  constructor(uniqueId: string | undefined, terria: Terria) {
    super(uniqueId, terria);

    makeObservable(this);

    runInAction(() => {
      if (this.terria.configParameters.mapboxKey) {
        this.setTrait(
          CommonStrata.defaults,
          "key",
          this.terria.configParameters.mapboxKey
        );
      }
    });
  }

  @override
  override showWarning() {
    if (!this.key || this.key === "") {
      console.warn(
        `The ${applyTranslationIfExists(this.name, i18next)}(${
          this.type
        }) geocoder will always return no results because a Bing Maps key has not been provided. Please get a Bing Maps key from bingmapsportal.com and add it to parameters.bingMapsKey in config.json.`
      );
    }
  }

  protected logEvent(searchText: string) {
    this.terria.analytics?.logEvent(
      Category.search,
      SearchAction.gazetteer,
      searchText
    );
  }

  protected async doSearch(
    searchText: string,
    searchResults: SearchProviderResults
  ): Promise<void> {
    searchResults.results.length = 0;
    searchResults.message = undefined;

    let response: MapboxIonGeocodeResult;
    try {
      let queryParameters = 
        `q=${searchText}&access_token=${this.key}&language=${this.language}&limit=${this.limit}`;

      if (this.country) {
        queryParameters += `&country=${this.country}`;
      }

      if (this.types) {
        queryParameters += `&types=${this.types}`;
      }

      if (this.proximity) {
        queryParameters += `&proximity=${this.proximity}`;
      }      

      response = await loadJson<MapboxIonGeocodeResult>(`${this.url}?${queryParameters}`);
    } catch (e) {
      searchResults.message = {
        content: "translate#viewModels.searchErrorOccurred"
      };
      return;
    }

    runInAction(() => {
      if (!response.features || response.features.length === 0) {
        searchResults.message = {
          content: "translate#viewModels.searchNoLocations"
        };
        return;
      }

      try {
        searchResults.results = response.features
          // .filter((feature) => {
          //   return feature.properties.bbox
          // })
          .map<SearchResult>((feature) => {
            // const [w, s, e, n] = feature.properties.bbox;
            // const rectangle = Rectangle.fromDegrees(w, s, e, n);

            // let name = "";
            // if (feature.properties.context.region) {
            //   name += feature.properties.context.region.name;
            // }

            // if (feature.properties.context.place) {
            //   name += feature.properties.context.place.name;
            // }

            // if (feature.properties.context.locality) {
            //   name += feature.properties.context.locality.name;
            // }

            let rectangle;
            let latitude;
            let longitude;
            if (feature.properties.bbox) {
              const [w, s, e, n] = feature.properties.bbox;
              rectangle = Rectangle.fromDegrees(w, s, e, n);
              latitude = (s + n) / 2;
              longitude = (e + w) / 2;

            } else {
              const _point = point([feature.geometry.coordinates[0], feature.geometry.coordinates[1]]);
              const _buffer = buffer(_point, 0.5, {units: "kilometers"});
              const _bbox = bbox(_buffer);
              const [w, s, e, n] = _bbox;
              rectangle = Rectangle.fromDegrees(w, s, e, n);
              latitude = feature.geometry.coordinates[1];
              longitude = feature.geometry.coordinates[0];
            }

            return new SearchResult({
              name: feature.properties.name,
              clickAction: createZoomToFunction(this, rectangle),
              location: {
                latitude: latitude,
                longitude: longitude
              }
            });
          });

        if (searchResults.results.length === 0) {
          searchResults.message = {
            content: "translate#viewModels.searchNoLocations"
          };
          return;
        }
      } catch(e) {
        searchResults.message = {
          content: "translate#viewModels.searchErrorOccurred"
        };
      }
    });
  }
}

function createZoomToFunction(
  model: MapboxSearchProvider,
  rectangle: Rectangle
) {
  return function () {
    const terria = model.terria;
    terria.currentViewer.zoomTo(rectangle, model.flightDurationSeconds);
  };
}