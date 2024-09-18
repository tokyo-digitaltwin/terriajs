// Original source
// https://github.com/Project-PLATEAU/terriajs/blob/fb8da86/lib/ReactViews/Workbench/Controls/StorySection.tsx

import React, { ReactChildren } from "react";
import { BaseModel } from "../../../Models/Definition/Model";
import ViewState from "../../../ReactViewModels/ViewState";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import styled from "styled-components";
import { Button } from "../../../Styled/Button";
import Cesium3DTilesCatalogItemTraits from "../../../Traits/TraitsClasses/Cesium3DTilesCatalogItemTraits";
import { GLYPHS, StyledIcon } from "../../../Styled/Icon";
import { useViewState } from "../../Context";
import WorkbenchButton from "../WorkbenchButton";

interface StoryCollection {
  name: string;
  items: any[];
}

interface StoryButtonProps {
  viewState: ViewState;
  storyCollection: StoryCollection;
}

const StoryButton: React.VFC<StoryButtonProps> = observer(
  ({ viewState, storyCollection }) => {
    const handleStoryStart = () => {
      runInAction(() => {
        viewState.terria.stories = storyCollection.items;
        viewState.currentStoryId = 0;
        viewState.storyShown = true;
      });
    };
    const handleStoryStop = () => {
      runInAction(() => {
        viewState.terria.stories = [];
      });
    };
    return viewState.storyShown &&
      storyCollection.items === viewState.terria.stories ? (
      <WorkbenchButton
        iconElement={() => (
          <StyledIcon styledWidth="20px" glyph={GLYPHS.pause} />
        )}
        onClick={handleStoryStop}
      >
        {storyCollection.name as any as ReactChildren}
      </WorkbenchButton>
    ) : (
      <WorkbenchButton
        iconElement={() => (
          <StyledIcon styledWidth="20px" glyph={GLYPHS.play} />
        )}
        onClick={handleStoryStart}
        disabled={!!viewState.storyShown && !!viewState.terria.stories.length}
      >
        {storyCollection.name as any as ReactChildren}
      </WorkbenchButton>
    );
  }
);

interface StorySectionProps {
  item: BaseModel | Cesium3DTilesCatalogItemTraits;
}

const StorySection: React.VFC<StorySectionProps> = observer(({ item }) => {
  const viewState = useViewState();
  if (!("customProperties" in item)) return null;
  const storyCollections = item.customProperties?.stories as unknown as
    | StoryCollection[]
    | null;
  if (!storyCollections) return null;
  return (
    <ListContainer>
      {storyCollections.map((storyCollection) => (
        <ListItem>
          <StoryButton
            viewState={viewState}
            storyCollection={storyCollection}
          />
        </ListItem>
      ))}
    </ListContainer>
  );
});

const ListContainer = styled.ul`
  list-style: none;
  padding: 8px 0 0;
`;
const ListItem = styled.li`
  display: flex;
  & + & {
    margin-top: 8px;
  }
`;

export default StorySection;
