import { runInAction } from "mobx";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import React, { useState } from "react";
import { Trans, useTranslation, withTranslation } from "react-i18next";
import styled, { withTheme } from "styled-components";
import Box from "../../Styled/Box";
import Button, { RawButton } from "../../Styled/Button";
import Icon, { StyledIcon } from "../../Styled/Icon";
import Spacing from "../../Styled/Spacing";
import Text, { TextSpan } from "../../Styled/Text";
import { useKeyPress } from "../Hooks/useKeyPress.js";
import { TourPortalDisplayName } from "../Tour/TourPortal";
import FadeIn from "../Transitions/FadeIn/FadeIn";
import SlideUpFadeIn from "../Transitions/SlideUpFadeIn/SlideUpFadeIn";
import { withViewState } from "../StandardUserInterface/ViewStateContext";

export const WELCOME_MESSAGE_NAME = "welcomeMessage";
export const LOCAL_PROPERTY_KEY = `${WELCOME_MESSAGE_NAME}Prompted`;

const WelcomeModalWrapper = styled(Box)`
  z-index: 99999;
  background-color: rgba(0, 0, 0, 0.75);
`;

function WelcomeMessageButton(props) {
  return (
    <Button primary rounded fullWidth onClick={props.onClick}>
      <Box centered>
        {props.buttonIcon && (
          <StyledIcon light styledWidth={"22px"} glyph={props.buttonIcon} />
        )}
        <Spacing right={2} />
        {props.buttonText && (
          <TextSpan textLight extraLarge>
            {props.buttonText}
          </TextSpan>
        )}
      </Box>
    </Button>
  );
}

WelcomeMessageButton.propTypes = {
  buttonText: PropTypes.string,
  buttonIcon: PropTypes.object,
  onClick: PropTypes.func
};

@observer
class WelcomeMessage extends React.Component {
  static displayName = "WelcomeMessage";

  static propTypes = {
    viewState: PropTypes.object,
    theme: PropTypes.object,
    t: PropTypes.func.isRequired
  };

  constructor(props) {
    super(props);
    const viewState = this.props.viewState;
    const shouldShow =
      (viewState.terria.configParameters.showWelcomeMessage &&
        !viewState.terria.getLocalProperty(LOCAL_PROPERTY_KEY)) ||
      false;

    this.props.viewState.setShowWelcomeMessage(shouldShow);
  }

  render() {
    const viewState = this.props.viewState || {};
    return (
      <WelcomeMessagePure
        showWelcomeMessage={viewState.showWelcomeMessage}
        setShowWelcomeMessage={bool =>
          this.props.viewState.setShowWelcomeMessage(bool)
        }
        isTopElement={this.props.viewState.topElement === "WelcomeMessage"}
        viewState={this.props.viewState}
      />
    );
  }
}

export const WelcomeMessagePure = props => {
  const { showWelcomeMessage, setShowWelcomeMessage, viewState } = props;
  const { t } = useTranslation();
  // This is required so we can do nested animations
  const [welcomeVisible, setWelcomeVisible] = useState(showWelcomeMessage);
  const [shouldTakeTour, setShouldTakeTour] = useState(false);
  const [shouldExploreData, setShouldExploreData] = useState(false);
  const [shouldOpenHelp, setShouldOpenHelp] = useState(false);
  // const {
  //   WelcomeMessagePrimaryBtnClick,
  //   WelcomeMessageSecondaryBtnClick
  // } = viewState.terria.overrides;
  const handleClose = (persist = false) => {
    setShowWelcomeMessage(false);
    setShouldOpenHelp(false);
    if (persist) {
      viewState.terria.setLocalProperty(LOCAL_PROPERTY_KEY, true);
    }
    // if cookie has not been accepted, disable analytics.
    if (!viewState.terria.getLocalProperty("useCookie")) {
      if (viewState.terria.analytics && viewState.terria.analytics.key) {
        delete viewState.terria.analytics.key;
      }
      window.gtag = function() {};
    }
    setShouldOpenHelp(false);
  };

  const handleCookieAcceptance = (accept = false) => {
    if (accept) {
      if (!viewState.terria.getLocalProperty("useCookie") && window.gtag) {
        delete window.gtag;
      }
    }
    viewState.terria.setLocalProperty("useCookie", accept);
    handleClose(false);
  };

  useKeyPress("Escape", () => {
    if (showWelcomeMessage && viewState.videoGuideVisible === "") {
      handleClose(false);
    }
  });

  return (
    <FadeIn
      isVisible={showWelcomeMessage}
      onEnter={() => setWelcomeVisible(true)}
      transitionProps={{
        onExiting: () => setWelcomeVisible(false),
        onExited: () => {
          if (shouldTakeTour) {
            setShouldTakeTour(false);
            viewState.setTourIndex(0);
            viewState.setShowTour(true);
            viewState.setTopElement(TourPortalDisplayName);
          }
          if (shouldExploreData) {
            setShouldExploreData(false);
            viewState.openAddData();
            viewState.setTopElement("AddData");
          }
          if (shouldOpenHelp) {
            setShouldOpenHelp(false);
            viewState.showHelpPanel();
          }
          // Show where help is when never previously prompted
          if (!viewState.terria.getLocalProperty("helpPrompted")) {
            runInAction(() => {
              viewState.toggleFeaturePrompt("help", true, false);
            });
          }
        }
      }}
    >
      <WelcomeModalWrapper
        fullWidth
        fullHeight
        position="absolute"
        right
        onClick={() => handleClose(false)}
      >
        <Box
          styledWidth={
            viewState.isMapFullScreen || viewState.useSmallScreenInterface
              ? "100%"
              : "calc(100% - 350px)"
          } // TODO: use variable $work-bench-width
          fullHeight
          centered
        >
          <SlideUpFadeIn isVisible={welcomeVisible}>
            <Box
              styledWidth={"667px"}
              styledMinHeight={"504px"}
              displayInlineBlock
              paddedRatio={6}
              onClick={e => {
                viewState.setTopElement("WelcomeMessage");
                e.stopPropagation();
              }}
            >
              <RawButton
                onClick={handleClose.bind(null, false)}
                css={`
                  float: right;
                `}
              >
                <StyledIcon
                  styledWidth={"24px"}
                  light
                  glyph={Icon.GLYPHS.closeLight}
                />
              </RawButton>
              <Spacing bottom={7} />
              <Box displayInlineBlock col10>
                <Text
                  bold
                  textLight
                  styledFontSize={"28px"}
                  styledLineHeight={"1.3"}
                >
                  {t("welcomeMessage.title")}
                </Text>
                <Spacing bottom={3} />
                <Text textLight medium>
                  <Trans i18nKey="welcomeMessage.welcomeMessage">
                    Interested in data discovery and exploration?
                    <br />
                    Dive right in and get started or check the following help
                    guide options.
                  </Trans>
                </Text>
              </Box>
              <Spacing bottom={viewState.useSmallScreenInterface ? 2 : 3} />
              <Box fullWidth centered>
                <Box fullWidth column>
                  <WelcomeMessageButton
                    onClick={() => {
                      handleClose(false);
                      // not sure if we should wait for the exit animation,
                      // if we don't, we have a flicker due to the difference
                      // in overlay darkness - but if we wait, it goes
                      // dark -> light -> dark anyway..
                      setShouldTakeTour(true);
                      viewState.setTourIndex(0);
                      viewState.setShowTour(true);
                      viewState.setTopElement(TourPortalDisplayName);
                    }}
                    buttonText={t("welcomeMessage.tourBtnText")}
                    buttonIcon={Icon.GLYPHS.tour}
                  />
                </Box>
              </Box>
              <Spacing bottom={viewState.useSmallScreenInterface ? 2 : 3} />
              <Box fullWidth centered>
                <Text textLight medium>
                  本ウェブサイトでは、より良いサイト運営のため、Cookie技術を使用します。
                  <br />
                  Cookieの使用について同意いただける場合は、「同意します」をクリックしてください。
                  <br />
                  <a
                    href={viewState.terria.configParameters.policyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TextSpan textLight isLink>
                      サイトポリシーを確認
                    </TextSpan>
                  </a>
                </Text>
              </Box>
              <Spacing bottom={2} />
              <Box fullWidth centered>
                <Button
                  primary
                  rounded
                  fullWidth
                  onClick={handleCookieAcceptance.bind(null, true)}
                >
                  <Box centered>
                    <TextSpan textLight extraLarge>
                      同意する
                    </TextSpan>
                  </Box>
                </Button>
                <Spacing right={5} />
                <Button
                  secondary
                  rounded
                  fullWidth
                  onClick={handleCookieAcceptance.bind(null, false)}
                >
                  <Box centered>
                    <TextSpan textDark extraLarge>
                      同意しない
                    </TextSpan>
                  </Box>
                </Button>
              </Box>
              <Spacing bottom={3} />
              <Box fullWidth centered>
                <RawButton onClick={handleClose.bind(null, true)}>
                  <TextSpan textLight isLink>
                    {t("welcomeMessage.dismissText")}
                  </TextSpan>
                </RawButton>
              </Box>
            </Box>
          </SlideUpFadeIn>
        </Box>
      </WelcomeModalWrapper>
    </FadeIn>
  );
};

WelcomeMessagePure.propTypes = {
  showWelcomeMessage: PropTypes.bool.isRequired,
  setShowWelcomeMessage: PropTypes.func.isRequired,
  isTopElement: PropTypes.bool.isRequired,
  viewState: PropTypes.object.isRequired
};

export default withTranslation()(withViewState(withTheme(WelcomeMessage)));
