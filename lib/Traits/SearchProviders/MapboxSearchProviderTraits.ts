import primitiveTrait from "../Decorators/primitiveTrait";
import mixTraits from "../mixTraits";
import LocationSearchProviderTraits, {
  SearchProviderMapCenterTraits
} from "./LocationSearchProviderTraits";

export default class MapboxSearchProviderTraits extends mixTraits(
  LocationSearchProviderTraits,
  SearchProviderMapCenterTraits
) {
  url: string = "https://api.mapbox.com/search/geocode/v6/forward";

  @primitiveTrait({
    type: "string",
    name: "Key",
    description: "The Mapbox key."
  })
  key?: string;

  @primitiveTrait({
    type: "string",
    name: "Country",
    description: `Limit results to one or more countries. 
    Permitted values are ISO 3166 alpha 2 country codes separated by commas.
    `
  })
  country?: string;

  @primitiveTrait({
    type: "string",
    name: "Language",
    description: `The language of the text supplied in responses. Also affects result scoring, 
    with results matching the user’s query in the requested language being preferred over results that match in another language.
    `
  })
  language: string = "en";

  @primitiveTrait({
    type: "number",
    name: "Country",
    description: "The maximum number of results to return. The maximum supported is 10."
  })
  limit: number = 5;

  @primitiveTrait({
    type: "string",
    name: "Types",
    description: `Filter results to include only a subset (one or more) of the available feature types.
    Options are country, region, postcode, district, place, locality, neighborhood, street, and address. 
    Multiple options can be comma-separated.
    `
  })
  types?: string;

  @primitiveTrait({
    type: "string",
    name: "Proximity",
    description: `Bias the response to favor results that are closer to a specific location. 
    Provide either ip to get results closest to the user's IP location or provide two comma-separated coordinates in longitude,latitude order. 
    If not provided, the default is IP proximity. 
    When both proximity and origin are provided, origin is interpreted as the target of a route, while proximity indicates the current user location.
    `
  })
  proximity?: string;  
}
