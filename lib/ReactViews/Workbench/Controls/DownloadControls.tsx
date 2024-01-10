import React from "react";
import Box from "../../../Styled/Box";
import Button from "../../../Styled/Button";
import { withTranslation, WithTranslation } from "react-i18next";
import { observer } from "mobx-react";
import ViewState from "../../../ReactViewModels/ViewState";
import { BaseModel } from "../../../Models/Definition/Model";
import { action, makeObservable, runInAction } from "mobx";
import Icon, { StyledIcon } from "../../../Styled/Icon";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import isDefined from "../../../Core/isDefined";

const getMultipleDownload = (item:CatalogMemberMixin.Instance) => {
  if (!item.customProperties || !item.customProperties.multipleDownload) {
    return false;
  }
  return item.customProperties.multipleDownload;
};

const getDownloadProperty = (item:CatalogMemberMixin.Instance) => {
  if (!item.customProperties || !item.customProperties.downloadUrlProperty) {
    return null;
  }
  return item.customProperties.downloadUrlProperty;
}

// original SidePanelButton
type DownloadButtonProps = {
  btnText?: string;
} & React.ComponentPropsWithoutRef<typeof Button>;

const DownloadButton = React.forwardRef<
  HTMLButtonElement,
  DownloadButtonProps
>((props, ref) => {
  const { btnText, ...rest } = props;
  return (
    <Button
      primary
      ref={ref}
      renderIcon={props.children && (() => props.children)}
      textProps={{
        large: true
      }}
      {...rest}
    >
      {btnText ? btnText : ""}
    </Button>
  );
});

interface PropsType extends WithTranslation {
  viewState: ViewState;
  item: BaseModel;
}

@observer
class DownloadControlls extends React.Component<
  PropsType
>{
  constructor(props: any) {
    // Required step: always call the parent class' constructor
    super(props);

    makeObservable(this);
  }

  /* eslint-disable-next-line camelcase */
  UNSAFE_componentWillMount() {
  }

  componentWillUnmount() {
  }

  @action
  startDownload(downloadProperty: string) {
    const viewState = this.props.viewState;
    const item = this.props.item;
    viewState.terria.currentViewer.startAreaDownloading((item as any)._dataSource, downloadProperty, this.onEndDownload.bind(this))
    runInAction(() => {
      this.props.viewState.workbenchItemWithDownloading = item.uniqueId;
    })
  }

  @action
  onEndDownload() {
    runInAction(() => {
      this.props.viewState.workbenchItemWithDownloading = undefined;
    })
  }

  @action
  onCancelDownload() {
    const viewState = this.props.viewState;
    viewState.terria.currentViewer.removeAreaDownloading();
    runInAction(() => {
      this.props.viewState.workbenchItemWithDownloading = undefined;
    })
  }

  @action
  downloadButton() {
    const viewState = this.props.viewState;
    const item = this.props.item;
    const isDownloading = item.uniqueId === viewState.workbenchItemWithDownloading;
    const downloadProperty = getDownloadProperty(item as CatalogMemberMixin.Instance);
    if (!isDefined(downloadProperty)) {
      return;
    }
    if (isDownloading) {
      this.onCancelDownload();
    } else {
      this.startDownload(downloadProperty as string);
    }
  }

  render() {
    const viewState = this.props.viewState;
    const item = this.props.item;
    const { t } = this.props;
    const isDownloading = item.uniqueId === viewState.workbenchItemWithDownloading;
    const visibleDownloadMenu = getMultipleDownload(item as CatalogMemberMixin.Instance);
    const areaDownloadTitle = isDownloading ? t('downloadControls.ariaDownloadSelected') : t('downloadControls.ariaDownloadUnselected');
    return (
      <>
        {visibleDownloadMenu ? (
          <Box css={`
            padding-top: 4px;
          `}>
            <Box justifySpaceBetween>
              <DownloadButton
                onClick={() => this.downloadButton()}
                title={areaDownloadTitle}
                btnText={areaDownloadTitle}
                css={`
                  flex: 1;
                  border-radius: 0;
                `}
              >
                <StyledIcon glyph={Icon.GLYPHS.download} light styledWidth={"20px"} />
              </DownloadButton>
            </Box>
          </Box>
        ) : null}
      </>
    )
  }
}
export default withTranslation()(DownloadControlls);
