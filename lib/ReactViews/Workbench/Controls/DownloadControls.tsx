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
        large: false
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
    viewState.terria.currentViewer.startAreaDownloading((item as any)._dataSource, downloadProperty, this.onStartDownload.bind(this), this.onDownloadProgress.bind(this), this.onEndDownload.bind(this))
    runInAction(() => {
      this.props.viewState.workbenchItemWithDownloading = item.uniqueId;
    })
  }

  @action
  onStartDownload() {
    const item = this.props.item;
    runInAction(() => {
      this.props.viewState.workbenchItemInDownloadProgress = 0;
      this.props.viewState.workbenchItemInDownloadSize = 0;
      this.props.viewState.workbenchItemWithDownloadProgress = item.uniqueId;
    })
  }

  @action
  onDownloadProgress(size: number, progress: number) {
    runInAction(() => {
      this.props.viewState.workbenchItemInDownloadSize = size;
      this.props.viewState.workbenchItemInDownloadProgress = progress;
    })
  }

  @action
  onEndDownload() {
    runInAction(() => {
      this.props.viewState.workbenchItemWithDownloading = undefined;
      this.props.viewState.workbenchItemWithDownloadProgress = undefined;
      this.props.viewState.workbenchItemInDownloadSize = undefined;
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
    let areaDownloadTitle = isDownloading ? t('downloadControls.ariaDownloadSelected') : t('downloadControls.ariaDownloadUnselected');
    const isDownloadProgress = item.uniqueId === viewState.workbenchItemWithDownloadProgress;
    const progress = viewState.workbenchItemInDownloadProgress as number;
    const size = viewState.workbenchItemInDownloadSize as number;
    if (isDownloadProgress) {
      areaDownloadTitle = t('downloadControls.downloadProgress', {size: size, progress: progress});
    }
    let disabledDownloadButton = false;
    if (!isDownloadProgress && viewState.workbenchItemWithDownloadProgress !== undefined) {
      disabledDownloadButton = true;
    }
    return (
      <>
        {visibleDownloadMenu ? (
          <Box css={`
            padding-top: 4px;
          `}>
            <Box justifySpaceBetween>
              <DownloadButton
                onClick={() => {
                  if (!isDownloadProgress) {
                    this.downloadButton()
                  }
                }}
                title={areaDownloadTitle}
                btnText={areaDownloadTitle}
                disabled={disabledDownloadButton}
                css={`
                  flex: 1;
                  border-radius: 0;
                  height: 32px;
                  min-height: 32px;
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
