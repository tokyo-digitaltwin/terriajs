declare namespace PrefecturesDropDownScssNamespace {
  export interface IPrefecturesDropDownScss {
    dropdown: string;
    "dropdown-children": string;
    dropdownChildren: string;
  }
}

declare const PrefecturesDropDownScssModule: PrefecturesDropDownScssNamespace.IPrefecturesDropDownScss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: PrefecturesDropDownScssNamespace.IPrefecturesDropDownScss;
};

export = PrefecturesDropDownScssModule;
