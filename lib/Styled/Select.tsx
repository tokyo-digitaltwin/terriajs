/**
 * sample usage:
 * 

<Select>
  <option>one</option>
  <option>two</option>
  <option>three</option>
</Select>

or if you need padding, box needed as select comes with zero padding
<Box paddedRatio={1}>
  <Select>
    <option>one</option>
    <option>two</option>
    <option>three</option>
  </Select>
</Box>

or with overrides on icon
<Select dropdownIconProps={{fillColor: props.theme.textLight}}>
  <option>one</option>
  <option>two</option>
  <option>three</option>
</Select>
 */

import React from "react";
import styled, { useTheme } from "styled-components";
import {} from "styled-components/cssprop";
const Box: any = require("./Box").default;
import { default as IconComponent, StyledIcon } from "../ReactViews/Icon";
const Icon: any = IconComponent;

const StyledSelect = styled.select<SelectProps>`
  -moz-appearance: none;
  -webkit-appearance: none;

  min-height: 34px; // use a bool prop when we figure out the smaller size
  width: 100%;

  border: none;
  border-radius: ${p => p.theme.radiusSmall};
  padding-left: 10px;
  padding-right: 30px; // For icon

  color: ${p => p.theme.textLight};
  background: ${p => p.theme.overlay};

  & option {
    color: ${p => p.theme.textBlack};
  }

  ${props =>
    props.light &&
    `
    color: ${props.theme.textBlack};
    background: ${props.theme.overlayInvert};
  `}

  ${props => props.disabled && `opacity: 0.3;`}
`;

const ArrowPositioning = styled.div`
  ${props => props.theme.verticalAlign("absolute")}
  right: 10px;
`;

interface SelectProps {
  boxProps?: any;
  dropdownIconProps?: any;
  light?: boolean;
  children: React.ReactNode;
  [spread: string]: any;
}

const Select: React.FC<SelectProps> = props => {
  const { children, boxProps, dropdownIconProps, ...rest }: SelectProps = props;
  const theme: any = useTheme();
  return (
    <Box fullWidth {...boxProps}>
      <StyledSelect {...rest}>{children}</StyledSelect>
      <ArrowPositioning>
        <StyledIcon
          // light bg needs dark icon
          fillColor={props.light ? theme.textBlack : theme.textLight}
          styledWidth="16px"
          glyph={Icon.GLYPHS.arrowDown}
          {...dropdownIconProps}
        />
      </ArrowPositioning>
    </Box>
  );
};

export default Select;