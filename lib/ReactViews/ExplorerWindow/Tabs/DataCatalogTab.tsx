import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import type CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import Box from "../../../Styled/Box";
import Icon, { StyledIcon } from "../../../Styled/Icon";
import { useViewState } from "../../Context";
import DataCatalog from "../../DataCatalog/DataCatalog";
import DataPreview from "../../Preview/DataPreview";
import Breadcrumbs from "../../Search/Breadcrumbs";
import SearchBox, { DEBOUNCE_INTERVAL } from "../../Search/SearchBox.jsx";
import Styles from "./data-catalog-tab.scss";
import CatalogSearchProvider from "../../../Models/SearchProviders/CatalogSearchProvider";
import Dropdown from "../../Generic/Dropdown";
import { useState } from "react";

interface DataCatalogTabProps {
  items?: unknown[];
  searchPlaceholder?: string;
  onActionButtonClicked?: (item: CatalogMemberMixin.Instance) => void;
}

const prefectureNotSelected = "地域を検索する";

const DataCatalogTab = observer(function DataCatalogTab(
  props: DataCatalogTabProps
) {
  const viewState = useViewState();
  const { t } = useTranslation();

  const {
    searchState,
    previewedItem: previewed,
    breadcrumbsShown: showBreadcrumbs,
    terria
  } = viewState;

  const [selectedOption, setSelectedOption] = useState({name: terria.selectedPrefectureOption === "" ? prefectureNotSelected : terria.selectedPrefectureOption });

  const searchPlaceholder =
    props.searchPlaceholder || t("addData.searchPlaceholder");

  const changeSearchText = (newText: string) => {
    runInAction(() => {
      viewState.searchState.catalogSearchText = newText;
    });
  };

  const search = () => {
    viewState.searchState.searchCatalog();
  };

  const options = () => {
    let options = [ {name: prefectureNotSelected} ];
    if (terria.configParameters.prefectureOptions.length === 0) {
      return options;
    } else {
      return options.concat(
        terria.configParameters.prefectureOptions.map(pref => ({name: pref}))
      );
    }
  }


  return (
    <div className={Styles.root}>
      <Box fullHeight column>
        <Box fullHeight overflow="hidden">
          <Box className={Styles.dataExplorer} styledWidth="40%">
            <Dropdown 
              children={
                <Box className={Styles.dropdownChildren}>
                  <StyledIcon
                    glyph={Icon.GLYPHS.address}
                    opacity={0.5}
                  />

                  <Box paddedHorizontally={2}>
                    {selectedOption.name}
                  </Box>
                </Box>
              }
              options={options()} 
              selectOption={(option, index) => {
                setSelectedOption(option);
                terria.selectedPrefectureOption = 
                  option.name !== prefectureNotSelected ? option.name : "";

                searchState.isWaitingToStartCatalogSearch = true;
                search();
              }}
              theme={
                {dropdown: Styles.dropdown}
              }
              useArrowIcon
              >
            </Dropdown>


            {searchState.catalogSearchProvider && (
              <SearchBox
                searchText={searchState.catalogSearchText}
                onSearchTextChanged={changeSearchText}
                onDoSearch={() => search()}
                placeholder={searchPlaceholder}
                debounceDuration={
                  terria.catalogReferencesLoaded
                    ? (
                        searchState.catalogSearchProvider as CatalogSearchProvider
                      ).debounceDurationOnceLoaded
                    : DEBOUNCE_INTERVAL
                }
              />
            )}
            <DataCatalog
              terria={terria}
              viewState={viewState}
              onActionButtonClicked={props.onActionButtonClicked}
              items={props.items}
            />
          </Box>
          <Box styledWidth="60%">
            <DataPreview
              terria={terria}
              viewState={viewState}
              previewed={previewed}
            />
          </Box>
        </Box>

        {showBreadcrumbs && (
          <Breadcrumbs
            terria={terria}
            viewState={viewState}
            previewed={previewed}
          />
        )}
      </Box>
    </div>
  );
});

export default DataCatalogTab;
