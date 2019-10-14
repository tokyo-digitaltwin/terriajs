import createReactClass from "create-react-class";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import React from "react";
import addedByUser from "../../Core/addedByUser";
import openGroup from "../../Models/openGroup";
import removeUserAddedData from "../../Models/removeUserAddedData";
import CatalogGroup from "./CatalogGroup";
import DataCatalogMember from "./DataCatalogMember";

const DataCatalogGroup = observer(
  createReactClass({
    displayName: "DataCatalogGroup",

    propTypes: {
      group: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired,
      /** Overrides whether to get the open state of the group from the group model or manage it internally */
      manageIsOpenLocally: PropTypes.bool,
      userData: PropTypes.bool,
      overrideState: PropTypes.string,
      onActionButtonClicked: PropTypes.func,
      removable: PropTypes.bool,
      terria: PropTypes.object,
      ancestors: PropTypes.array,
      isTopLevel: PropTypes.bool
    },

    getDefaultProps() {
      return {
        manageIsOpenLocally: false,
        userData: false
      };
    },

    getInitialState() {
      return {
        /** Only used if manageIsOpenLocally === true */
        isOpen: false
      };
    },

    toggleStateIsOpen() {
      this.setState({
        isOpen: !this.state.isOpen
      });
    },

    isOpen() {
      if (this.props.manageIsOpenLocally) {
        return this.state.isOpen;
      }
      return this.props.group.isOpen;
    },

    toggleOpen() {
      if (this.props.manageIsOpenLocally) {
        this.toggleStateIsOpen();
      } else {
        openGroup(this.props.terria, this.props.group);
      }
    },

    clickGroup() {
      this.toggleOpen();
      this.props.group.loadMembers();
      this.props.viewState.viewCatalogMember(
        this.props.group,
        this.props.ancestors
      );
    },

    isSelected() {
      return addedByUser(this.props.group)
        ? this.props.viewState.userDataPreviewedItem === this.props.group
        : this.props.viewState.previewedItem === this.props.group;
    },

    getNameOrPrettyUrl() {
      // Grab a name via nameInCatalog, if it's a blank string, try and generate one from the url
      const group = this.props.group;
      const nameInCatalog = group.nameInCatalog || "";
      if (nameInCatalog !== "") {
        return nameInCatalog;
      }

      const url = group.url || "";
      // strip protocol
      return url.replace(/^https?:\/\//, "");
    },

    render() {
      const group = this.props.group;

      return (
        <CatalogGroup
          text={this.getNameOrPrettyUrl()}
          title={this.props.ancestors
            .map(member => member.nameInCatalog)
            .join(" → ")}
          topLevel={this.props.isTopLevel}
          open={this.isOpen()}
          loading={group.isLoading || group.isLoadingMembers}
          emptyMessage="This group is empty"
          onClick={this.clickGroup}
          removable={this.props.removable}
          removeUserAddedData={removeUserAddedData.bind(
            this,
            this.props.terria,
            this.props.group
          )}
          selected={this.isSelected()}
        >
          <If condition={this.isOpen()}>
            <For each="item" of={group.memberModels}>
              <DataCatalogMember
                key={item.uniqueId}
                member={item}
                terria={this.props.terria}
                viewState={this.props.viewState}
                userData={this.props.userData}
                overrideOpen={this.props.manageIsOpenLocally}
                overrideState={this.props.overrideState}
                onActionButtonClicked={this.props.onActionButtonClicked}
                ancestors={[...this.props.ancestors, group]}
              />
            </For>
          </If>
        </CatalogGroup>
      );
    }
  })
);

module.exports = DataCatalogGroup;
