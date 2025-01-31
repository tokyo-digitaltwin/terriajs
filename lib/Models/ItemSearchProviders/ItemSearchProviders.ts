import Constructor from "../../Core/Constructor";
import ItemSearchProvider from "./ItemSearchProvider";
import IndexedItemSearchProvider from "./IndexedItemSearchProvider";
import DataSourceItemSearchProvider from "./DataSourceItemSearchProvider";

export const ItemSearchProviders = new Map<
  string,
  Constructor<ItemSearchProvider>
>([
  ["data-source", DataSourceItemSearchProvider],
  ["indexed", IndexedItemSearchProvider]
]);

export function registerItemSearchProvider(
  type: string,
  providerClass: Constructor<ItemSearchProvider>
) {
  ItemSearchProviders.set(type, providerClass);
}
