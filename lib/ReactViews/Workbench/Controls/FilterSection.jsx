import { runInAction } from "mobx";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import { Range } from "rc-slider";
import React from "react";
import CommonStrata from "../../../Models/Definition/CommonStrata";
import Styles from "./filter-section.scss";
import { withTranslation } from "react-i18next";

@observer
class FilterSection extends React.Component {
  static propTypes = {
    item: PropTypes.object.isRequired,
    t: PropTypes.func.isRequired
  };

  change(filter, values) {
    runInAction(() => {
      filter.setTrait(CommonStrata.user, "minimumShown", values[0]);
      filter.setTrait(CommonStrata.user, "maximumShown", values[1]);
    });
    this.props.item.terria.currentViewer.notifyRepaintRequired();
  }

  render() {
    const item = this.props.item;
    if (!item.filters || item.filters.length === 0) {
      return null;
    }
    return (
      <div className={Styles.filters}>
        {item.filters.map(this.renderFilter.bind(this))}
      </div>
    );
  }

  renderFilter(filter) {
    const values = [filter.minimumShown, filter.maximumShown];
    const { t } = this.props;
    return (
      <div key={filter.property} className={Styles.filter}>
        <label htmlFor={filter.property}>
          {t("workbench.filter", {
            name: filter.name,
            minimumShown: filter.minimumShown,
            maximumShown: filter.maximumShown
          })}
        </label>
        <Range
          value={values}
          allowCross={false}
          min={filter.minimumValue}
          max={filter.maximumValue}
          onChange={this.change.bind(this, filter)}
        />
      </div>
    );
  }
}

export default withTranslation()(FilterSection);
