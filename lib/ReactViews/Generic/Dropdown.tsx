import React, { useState, useRef, useEffect, useCallback } from "react";
import classNames from "classnames";

import Styles from "./dropdown.scss";
import { OutsideClickHandler } from "./OutsideClickHandler";
import Box from "../../Styled/Box";
import Icon, { StyledIcon } from "../../Styled/Icon";

interface Theme {
  isOpen?: string;
  dropdown?: string;
  button?: string;
  list?: string;
  btnOption?: string;
  icon?: React.ReactNode;
}

type MappedOption<T extends string = "name"> = {
  [key in T]: string;
};

type Option<P extends string = "name"> = MappedOption<P> & {
  href?: string;
  download?: string;
};

interface DropdownProps<
  P extends string = "name",
  T extends Option<P> = Option<P>
> {
  theme?: Theme;
  options?: T[];
  selected?: T;
  selectOption?: (option: T, index: number) => void;
  textProperty?: P;
  matchWidth?: boolean;
  children?: React.ReactNode;
  disabled?: boolean;
  align?: "left" | "right";
  useArrowIcon?: boolean;
}

const Dropdown = <P extends string = "name", T extends Option<P> = Option<P>>({
  theme = {},
  options = [],
  selected,
  selectOption,
  textProperty = "name" as P,
  disabled = false,
  children,
  useArrowIcon,
}: DropdownProps<P, T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollListeners = useRef<Element[]>([]);

  const hideList = useCallback(() => {
    setIsOpen(false);
  }, []);

  const showList = useCallback(() => {
    setIsOpen(true);
  }, []);

  const select = useCallback(
    (option: T, index: number) => {
      selectOption?.(option, index);
      hideList();
    },
    [selectOption, hideList]
  );

  const addScrollListeners = useCallback(
    (element: Element | null, listeningToSoFar: Element[]): Element[] => {
      if (!element) return listeningToSoFar;

      if (element.scrollHeight > element.clientHeight) {
        element.addEventListener("scroll", hideList);
        listeningToSoFar.push(element);
      }

      if (element !== document.body) {
        return addScrollListeners(element.parentElement, listeningToSoFar);
      }
      return listeningToSoFar;
    },
    [hideList]
  );

  const clearListeners = useCallback(() => {
    scrollListeners.current.forEach((element) =>
      element?.removeEventListener("scroll", hideList)
    );
    scrollListeners.current = [];
  }, [hideList]);

  useEffect(() => {
    if (isOpen) {
      scrollListeners.current = addScrollListeners(buttonRef.current, []);
    } else {
      clearListeners();
    }

    return clearListeners;
  }, [addScrollListeners, clearListeners, hideList, isOpen]);

  const selectedText = selected?.[textProperty];

  return (
    <div className={classNames(Styles.dropdown, theme.dropdown)}>
      <OutsideClickHandler disabled={!isOpen} onOutsideClick={hideList}>
        <button
          type="button"
          onClick={isOpen ? hideList : showList}
          className={classNames(theme.button, Styles.btnDropdown)}
          ref={buttonRef}
          disabled={disabled}
        >
          {selectedText || children}
          {theme.icon}

          {useArrowIcon && (
            <span style={{
              width: "0",
              height: "0",
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #64748b",
              position: "absolute",
              right: "12px",
              top: "44%",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
            }}/>
          )}

        </button>
        <ul
          className={classNames(Styles.list, theme.list, {
            [Styles.isOpen]: isOpen,
            [theme.isOpen ?? ""]: isOpen
          })}
        >
          {options.map((option, i) => {
            const optionText = option[textProperty];
            return (
              <li key={optionText}>
                {option.href ? (
                  <a
                    href={option.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(
                      Styles.btnOption,
                      theme.btnOption || "",
                      {
                        [Styles.isSelected]: option === selected
                      }
                    )}
                    download={option.download}
                  >
                    {optionText}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={classNames(
                      Styles.btnOption,
                      theme.btnOption || "",
                      {
                        [Styles.isSelected]: option === selected
                      }
                    )}
                    onClick={() => select(option, i)}
                  >
                    {optionText}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </OutsideClickHandler>
    </div>
  );
};

export default Dropdown;
