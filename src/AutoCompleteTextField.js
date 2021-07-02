import React, { createRef } from 'react';
import PropTypes from 'prop-types';
import getCaretCoordinates from 'textarea-caret';
import getInputSelection, { setCaretPosition } from 'get-input-selection';
import './AutoCompleteTextField.css';

const KEY_UP = 38;
const KEY_DOWN = 40;
const KEY_RETURN = 13;
const KEY_ENTER = 14;
const KEY_ESCAPE = 27;
const KEY_TAB = 9;

const OPTION_LIST_Y_OFFSET = 10;
const OPTION_LIST_MIN_WIDTH = 300;

const propTypes = {
  Component: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  defaultValue: PropTypes.string,
  disabled: PropTypes.bool,
  maxOptions: PropTypes.number,
  onBlur: PropTypes.func,
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onRequestOptions: PropTypes.func,
  onSelect: PropTypes.func,
  changeOnSelect: PropTypes.func,
  options: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  regex: PropTypes.string,
  matchAny: PropTypes.bool,
  minChars: PropTypes.number,
  disableMinChars: PropTypes.arrayOf(PropTypes.string),
  requestOnlyIfNoOptions: PropTypes.bool,
  spaceRemovers: PropTypes.arrayOf(PropTypes.string),
  spacer: PropTypes.string,
  trigger: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  disableSpacerOn: PropTypes.arrayOf(PropTypes.string),
  value: PropTypes.string,
  offsetX: PropTypes.number,
  offsetY: PropTypes.number,
  containerMaxHeight: PropTypes.number,
  itemHeight: PropTypes.number,
  passThroughEnter: PropTypes.bool,
  styles: PropTypes.shape({
    container: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    list: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  }),
};

const defaultProps = {
  Component: 'textarea',
  defaultValue: '',
  disabled: false,
  maxOptions: 0,
  onBlur: () => {},
  onChange: () => {},
  onKeyDown: () => {},
  onRequestOptions: () => {},
  onSelect: () => {},
  changeOnSelect: (trigger, slug) => trigger + slug,
  options: [],
  regex: '^[A-Za-z0-9\\-_]+$',
  matchAny: false,
  minChars: 0,
  disableMinChars: [],
  requestOnlyIfNoOptions: true,
  spaceRemovers: [',', '.', '!', '?'],
  spacer: ' ',
  disableSpacerOn: [],
  trigger: '@',
  offsetX: 0,
  offsetY: 0,
  containerMaxHeight: 200,
  itemHeight: 27,
  value: null,
  passThroughEnter: false,
  styles: {},
};

class AutocompleteTextField extends React.Component {
  constructor(props) {
    super(props);

    this.isTrigger = this.isTrigger.bind(this);
    this.arrayTriggerMatch = this.arrayTriggerMatch.bind(this);
    this.getMatch = this.getMatch.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleSelection = this.handleSelection.bind(this);
    this.updateCaretPosition = this.updateCaretPosition.bind(this);
    this.updateHelper = this.updateHelper.bind(this);
    this.resetHelper = this.resetHelper.bind(this);
    this.renderAutocompleteList = this.renderAutocompleteList.bind(this);
    this.handleMoveSelection = this.handleMoveSelection.bind(this);

    this.state = {
      helperVisible: false,
      left: 0,
      trigger: null,
      matchLength: 0,
      matchStart: 0,
      options: [],
      selection: 0,
      top: 0,
      value: null,
    };

    this.recentValue = props.defaultValue;
    this.enableSpaceRemovers = false;
    this.refInput = createRef();
    this.refSuggestion = createRef();
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
  }

  componentDidUpdate(prevProps) {
    const { options } = this.props;
    const { caret } = this.state;

    if (options.length !== prevProps.options.length) {
      this.updateHelper(this.recentValue, caret, options);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  getMatch(str, caret, providedOptions) {
    // get trigger, matchAny and regex from props
    const {
      trigger, minChars, matchAny, regex,
    } = this.props;
    // instantiate regexp with params passed from props
    const re = new RegExp(regex);

    // rename trigger variable into triggers
    let triggers = trigger;
    // if trigger is not an array, because trigger can be a `string`
    if (!Array.isArray(triggers)) {
      // change it into an array
      triggers = new Array(trigger);
    }
    // sort triggers array
    triggers.sort();

    // create variable to store options object from props
    const providedOptionsObject = providedOptions;
    // if options is an array then
    if (Array.isArray(providedOptions)) {
      // store every options on every trigger
      triggers.forEach((triggerStr) => {
        providedOptionsObject[triggerStr] = providedOptions;
      });
    }

    // get an array of configured trigger object
    const triggersMatch = this.arrayTriggerMatch(triggers, re);
    let slugData = null;

    // loop through triggersMatch array
    for (
      let triggersIndex = 0;
      triggersIndex < triggersMatch.length;
      triggersIndex++
    ) {
      // get all data from current triggersMatch object
      const { triggerStr, triggerMatch, triggerLength } = triggersMatch[
        triggersIndex
      ];

      // loop from caret position index until 0
      for (let i = caret - 1; i >= 0; --i) {
        // get partial string from current index i until caret position
        const substr = str.substring(i, caret);
        // match partial string with specified regexp
        const match = substr.match(re);
        // create variable matchStart and assign with -1
        let matchStart = -1;

        // if trigger's character is not an empty string
        // THE PROCESS OF GETTING MATCHED OPTIONS WITH CURRENTLY TYPED STRING
        // AND ITS TRIGGER
        if (triggerLength > 0) {
          // create variable `triggerIdx` and assign it with value of `i`
          // or calculation result of current value of `i` minus value of `triggerLength` plus 1
          const triggerIdx = triggerMatch ? i : i - triggerLength + 1;

          // if triggerIdx is less than 0 then exit the loop
          if (triggerIdx < 0) {
            // out of input
            break;
          }

          // if current str contains trigger char then
          if (this.isTrigger(triggerStr, str, triggerIdx)) {
            // change value of matchStart with value of `triggerIdx` plus `triggerLength`
            matchStart = triggerIdx + triggerLength;
          }

          // if regexp is not match and matchStart is less than 0
          if (!match && matchStart < 0) {
            // then exit loop
            break;
          }
        } else {
          // block to handle trigger with empty string
          const spaceCharIndex = str.lastIndexOf(' ', caret);
          matchStart = spaceCharIndex >= 0 ? spaceCharIndex + 1 : 0;
          if (caret - matchStart <= minChars - 1) {
            // matched slug is empty
            break;
          }
        }

        // if match index is bigger or equal to 0
        if (matchStart >= 0) {
          // get options of current triggerStr
          const triggerOptions = providedOptionsObject[triggerStr];
          // if options is null then skip loop
          if (triggerOptions == null) {
            continue;
          }

          const matchedSlug = str.substring(matchStart, caret);

          // filter available options so it only display options that contain
          // matched slug of trigger
          let options = [];
          if (!Array.isArray(triggerOptions)) {
            const spaceCharIndex = str.lastIndexOf(' ', matchStart);
            const suggestIndex = spaceCharIndex >= 0 ? spaceCharIndex : 0;
            const variableNameRaw = str.slice(suggestIndex, matchStart);
            const mappedVariableProp = variableNameRaw
              .split(triggerStr)
              .map((v) => v.trim().replaceAll("'", ''))
              .filter((v) => v.length);
            let k = 1;
            let currentObj = triggerOptions[mappedVariableProp[0]];
            while (k < mappedVariableProp.length) {
              if (currentObj[mappedVariableProp[k]]) {
                currentObj = currentObj[mappedVariableProp[k]];
              } else {
                currentObj = {};
                break;
              }
              k += 1;
            }

            options = Object.keys(currentObj || []).filter((slug) => {
              const idx = slug.toLowerCase().indexOf(matchedSlug.toLowerCase());
              return idx !== -1 && (matchAny || idx === 0);
            });
          } else {
            options = triggerOptions.filter((slug) => {
              const idx = slug.toLowerCase().indexOf(matchedSlug.toLowerCase());
              return idx !== -1 && (matchAny || idx === 0);
            });
          }

          const currTrigger = triggerStr;
          const matchLength = matchedSlug.length;

          // store data in `slugData` object
          if (slugData === null) {
            slugData = {
              trigger: currTrigger,
              matchStart,
              matchLength,
              options,
            };
          } else {
            slugData = {
              ...slugData,
              trigger: currTrigger,
              matchStart,
              matchLength,
              options,
            };
          }
          // exit loop if trigger is an empty string,
          // no need to iterate through textarea value char
          // since `matchStart` is calculated using the index of ' ' space character
          if (triggerLength === 0) break;
        }
      }
    }

    return slugData;
  }

  arrayTriggerMatch(triggers, re) {
    // map triggers item and then store on every trigger an object
    const triggersMatch = triggers.map((trigger) => ({
      triggerStr: trigger, // string to type to trigger the options
      triggerMatch: trigger.match(re), // regexp to match this trigger
      triggerLength: trigger.length, // number of char of this trigger
    }));

    // return array of trigger object
    return triggersMatch;
  }

  isTrigger(trigger, str, i) {
    // if trigger string is not empty or trigger string has length that's not 0
    // then return true
    if (!trigger || !trigger.length) {
      return true;
    }

    // if current string contains trigger char then return true
    if (str.substr(i, trigger.length) === trigger) {
      return true;
    }

    return false;
  }

  handleChange(e) {
    const {
      onChange, options, spaceRemovers, spacer, value,
    } = this.props;

    // store recent value into variable `old`
    const old = this.recentValue;
    // store current textarea value into variable `str`
    const str = e.target.value;
    // get caret position inside textarea
    const caret = getInputSelection(e.target).end;

    // if current textarea is empty then hide suggestion popover
    if (!str.length) {
      this.setState({ helperVisible: false });
    }

    // set `recentValue` with current textarea value
    this.recentValue = str;

    // change caret position and value on component state
    this.setState({ caret, value: e.target.value });

    // if textarea is empty and caret position is not set then do nothing, and call onChange callback
    if (!str.length || !caret) {
      return onChange(e.target.value);
    }

    // if enableSpaceRemovers prop is assigned then
    // '@wonderjenny ,|' -> '@wonderjenny, |'
    if (
      this.enableSpaceRemovers
      && spaceRemovers.length
      && str.length > 2
      && spacer.length
    ) {
      // loop every char from index 0 until maximum length of previous value and current value
      // of textarea
      for (let i = 0; i < Math.max(old.length, str.length); ++i) {
        // if character on current index is different on previouse value and current value
        if (old[i] !== str[i]) {
          // if current index is greater than or equal 2 and
          // current value
          if (
            i >= 2
            && str[i - 1] === spacer
            && spaceRemovers.indexOf(str[i - 2]) === -1
            && spaceRemovers.indexOf(str[i]) !== -1
            && this.getMatch(str.substring(0, i - 2), caret - 3, options)
          ) {
            // recompose textarea value by removing `spaceRemovers` character
            const newValue = `${str.slice(0, i - 1)}${str.slice(
              i,
              i + 1,
            )}${str.slice(i - 1, i)}${str.slice(i + 1)}`;

            // update caret position on state and change caret position on textarea
            this.updateCaretPosition(i + 1);
            // change textarea value using newValue
            this.refInput.current.value = newValue;

            // if value is not empty then change value data on component's state
            if (!value) {
              this.setState({ value: newValue });
            }

            // call onChange callback and pass newValue as argument
            return onChange(newValue);
          }

          // exit loop
          break;
        }
      }

      // NOTE: this line is confusing
      this.enableSpaceRemovers = false;
    }

    // call update helper
    this.updateHelper(str, caret, options);

    // NOTE: this line is confusing and seems useless
    // if value is empty then update value data on component's state
    if (!value) {
      this.setState({ value: e.target.value });
    }

    return onChange(e.target.value);
  }

  handleKeyDown(event) {
    const { helperVisible, options, selection } = this.state;
    const { onKeyDown, passThroughEnter } = this.props;

    if (helperVisible) {
      switch (event.keyCode) {
        case KEY_ESCAPE:
          event.preventDefault();
          event.stopPropagation();
          this.resetHelper();
          break;
        case KEY_UP: {
          event.preventDefault();
          const updatedSelection = (options.length + selection - 1) % options.length;
          this.setState({
            selection: updatedSelection,
          });
          this.handleMoveSelection(updatedSelection);
          break;
        }
        case KEY_DOWN: {
          const updatedSelection = (selection + 1) % options.length;
          event.preventDefault();
          this.setState({ selection: updatedSelection });
          this.handleMoveSelection(updatedSelection);
          break;
        }
        case KEY_ENTER:
        case KEY_RETURN:
          if (!passThroughEnter) {
            event.preventDefault();
          }
          this.handleSelection(selection);
          break;
        case KEY_TAB:
          this.handleSelection(selection);
          break;
        default:
          onKeyDown(event);
          break;
      }
    } else {
      onKeyDown(event);
    }
  }

  handleResize() {
    this.setState({ helperVisible: false });
  }

  handleSelection(idx) {
    const {
      spacer, onSelect, changeOnSelect, disableSpacerOn,
    } = this.props;
    const {
      matchStart, matchLength, options, trigger,
    } = this.state;

    const slug = options[idx];
    const value = this.recentValue;
    const part1 = value.substring(0, matchStart - trigger.length);
    const part2 = value.substring(matchStart + matchLength);

    const event = { target: this.refInput.current };
    const changedStr = changeOnSelect(trigger, slug);

    const spacerStr = disableSpacerOn.includes(trigger) ? '' : spacer;
    event.target.value = `${part1}${changedStr}${spacerStr}${part2}`;
    this.handleChange(event);
    onSelect(event.target.value);

    this.resetHelper();

    this.updateCaretPosition(part1.length + changedStr.length + 1);

    this.enableSpaceRemovers = true;
  }

  handleMoveSelection(selection) {
    if (this.refSuggestion.current) {
      const { containerMaxHeight, itemHeight } = this.props;
      const suggestionEl = this.refSuggestion.current;
      const isScrollable = suggestionEl.scrollHeight > suggestionEl.clientHeight;
      if (isScrollable) {
        const space = containerMaxHeight - itemHeight;
        const currentSelectionPos = itemHeight * selection - space;
        suggestionEl.scrollTo(0, currentSelectionPos);
      }
    }
  }

  updateCaretPosition(caret) {
    this.setState({ caret }, () => setCaretPosition(this.refInput.current, caret));
  }

  updateHelper(str, caret, options) {
    // get textarea reference
    const input = this.refInput.current;

    // get slug data on current caret position and textarea value
    const slug = this.getMatch(str, caret, options);

    // if slug data is not empty
    if (slug) {
      // get position of caret
      const caretPos = getCaretCoordinates(input, caret);
      const rect = input.getBoundingClientRect();

      const top = caretPos.top + input.offsetTop;
      const left = Math.min(
        caretPos.left + input.offsetLeft - OPTION_LIST_Y_OFFSET,
        input.offsetLeft + rect.width - OPTION_LIST_MIN_WIDTH,
      );

      const {
        minChars,
        disableMinChars,
        onRequestOptions,
        requestOnlyIfNoOptions,
      } = this.props;
      if (
        (slug.matchLength >= minChars
          || disableMinChars.includes(slug.trigger))
        && (slug.options.length > 1
          || (slug.options.length === 1
            && slug.options[0].length !== slug.matchLength))
      ) {
        this.setState({
          helperVisible: true,
          top,
          left,
          ...slug,
        });
      } else {
        if (!requestOnlyIfNoOptions || !slug.options.length) {
          // call onRequestOptions callback
          onRequestOptions(str.substr(slug.matchStart, slug.matchLength));
        }

        this.resetHelper();
      }
    } else {
      this.resetHelper();
    }
  }

  resetHelper() {
    this.setState({ helperVisible: false, selection: 0 });
  }

  renderAutocompleteList() {
    const {
      helperVisible,
      left,
      matchStart,
      matchLength,
      options,
      selection,
      top,
      value,
    } = this.state;

    if (!helperVisible) {
      return null;
    }

    const {
      maxOptions, offsetX, offsetY, containerMaxHeight, itemHeight, styles,
    } = this.props;

    if (options.length === 0) {
      return null;
    }

    if (selection >= options.length) {
      this.setState({ selection: 0 });

      return null;
    }

    const optionNumber = maxOptions === 0 ? options.length : maxOptions;
    const styling = typeof styles.container === 'object' ? styles.container : {};

    const helperOptions = options.slice(0, optionNumber).map((val, idx) => {
      const highlightStart = val
        .toLowerCase()
        .indexOf(value.substr(matchStart, matchLength).toLowerCase());
      const listClassName = typeof styles.list === 'string' ? styles.list : '';
      const listStyles = typeof styles.list === 'object' ? styles.list : {};

      return (
        <li
          className={
            idx === selection ? `${listClassName} active` : listClassName
          }
          key={val}
          onClick={() => {
            this.handleSelection(idx);
          }}
          style={{ ...listStyles, height: itemHeight }}
        >
          {val.slice(0, highlightStart)}
          <strong style={{ color: 'red' }}>
            {val.substr(highlightStart, matchLength)}
          </strong>
          {val.slice(highlightStart + matchLength)}
        </li>
      );
    });

    return (
      <ul
        ref={this.refSuggestion}
        className={
          typeof styles.container === 'string'
            ? styles.container
            : 'react-autocomplete-input'
        }
        style={{
          ...styling,
          left: left + offsetX,
          top: top + offsetY,
          overflowY: 'auto',
          overflowX: 'hidden',
          maxHeight: containerMaxHeight,
        }}
      >
        {helperOptions}
      </ul>
    );
  }

  render() {
    const {
      Component,
      defaultValue,
      disabled,
      onBlur,
      value,
      ...rest
    } = this.props;

    const { value: stateValue } = this.state;

    const propagated = Object.assign({}, rest);
    Object.keys(propTypes).forEach((k) => {
      delete propagated[k];
    });

    let val = '';

    if (typeof value !== 'undefined' && value !== null) {
      val = value;
    } else if (stateValue) {
      val = stateValue;
    } else if (defaultValue) {
      val = defaultValue;
    }

    return (
      <span>
        <Component
          disabled={disabled}
          onBlur={onBlur}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          ref={this.refInput}
          value={val}
          {...propagated}
        />
        {this.renderAutocompleteList()}
      </span>
    );
  }
}

AutocompleteTextField.propTypes = propTypes;
AutocompleteTextField.defaultProps = defaultProps;

export default AutocompleteTextField;
