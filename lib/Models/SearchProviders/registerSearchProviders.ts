import AustralianGazetteerSearchProvider from "./AustralianGazetteerSearchProvider";
import BingMapsSearchProvider from "./BingMapsSearchProvider";
import CesiumIonSearchProvider from "./CesiumIonSearchProvider";
import NominatimSearchProvider from "./NominatimSearchProvider";
import MapboxSearchProvider from "./MapboxSearchProvider";
import SearchProviderFactory from "./SearchProviderFactory";

export default function registerSearchProviders() {
  // SearchProviderFactory.register(
  //   BingMapsSearchProvider.type,
  //   BingMapsSearchProvider
  // );

  SearchProviderFactory.register(
    MapboxSearchProvider.type,
    MapboxSearchProvider
  );

  SearchProviderFactory.register(
    CesiumIonSearchProvider.type,
    CesiumIonSearchProvider
  );

  SearchProviderFactory.register(
    NominatimSearchProvider.type,
    NominatimSearchProvider
  );

  SearchProviderFactory.register(
    AustralianGazetteerSearchProvider.type,
    AustralianGazetteerSearchProvider
  );
}
