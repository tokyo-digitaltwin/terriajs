import React, {useState} from "react";
import Dropdown from "../Generic/Dropdown";
import Box from "../../Styled/Box";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { useViewState } from "../Context";
import Styles from "./prefectures-drop-down.scss";

const PrefecturesDropDown: React.FC = () => {

	const prefectureNotSelected = "地域を検索する";

	const viewState = useViewState();
	const { terria, searchState } = viewState;

	const [selectedOption, setSelectedOption] = useState({name: terria.selectedPrefectureOption === "" ? prefectureNotSelected : terria.selectedPrefectureOption });

	const search = () => {
		searchState.searchCatalog();
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

	);
};

export default PrefecturesDropDown;