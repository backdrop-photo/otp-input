/// <reference path="index.d.ts" />
import {
  InputProps,
  OTPInputViewState,
} from "@backdrop-photo/react-native-otp-input";
import React, { Component } from "react";
import {
  View,
  TextInput,
  TouchableWithoutFeedback,
  I18nManager,
  EmitterSubscription,
} from "react-native";
import Clipboard from "@react-native-community/clipboard";
import styles from "./styles";
import { isAutoFillSupported } from "./helpers/device";
import { codeToArray } from "./helpers/codeToArray";

export default class OTPInputView extends Component<
  InputProps,
  OTPInputViewState
> {
  static defaultProps: InputProps = {
    autoFocusOnLoad: true,
    clearInputs: false,
    editable: true,
    keyboardAppearance: "default",
    keyboardType: "number-pad",
    pinCount: 6,
    placeholderCharacter: "",
    secureTextEntry: false,
    selectionColor: "#000",
  };

  private fields: TextInput[] | null[] = [];

  private keyboardDidHideListener?: EmitterSubscription;

  private timer?: NodeJS.Timeout;

  private hasCheckedClipBoard?: boolean;

  private clipBoardCode?: string;

  constructor(props: InputProps) {
    super(props);
    const { code, autoFocusOnLoad } = props;
    this.state = {
      digits: codeToArray(code),
      selectedIndex: autoFocusOnLoad ? 0 : -1,
    };
  }

  componentDidMount() {
    this.copyCodeFromClipBoardOnAndroid();
    this.bringUpKeyBoardIfNeeded();
  }

  UNSAFE_componentWillReceiveProps(nextProps: InputProps) {
    const { code } = this.props;
    if (nextProps.code !== code) {
      this.setState({ digits: codeToArray(nextProps.code) });
    }
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.keyboardDidHideListener?.remove();
  }

  private copyCodeFromClipBoardOnAndroid = () => {
    // if (Platform.OS === "android") {
    this.checkPinCodeFromClipBoard();
    this.timer = setInterval(this.checkPinCodeFromClipBoard, 400);
    // }
  };

  bringUpKeyBoardIfNeeded = () => {
    const { autoFocusOnLoad, pinCount } = this.props;
    const digits = this.getDigits();
    const focusIndex = digits.length > 0 ? digits.length - 1 : 0;
    if (focusIndex < pinCount && autoFocusOnLoad) {
      this.focusField(focusIndex);
    }
  };

  getDigits = () => {
    const { digits: innerDigits } = this.state;
    const { code } = this.props;
    return code === undefined ? innerDigits : [...code];
  };

  private notifyCodeChanged = () => {
    const { digits } = this.state;
    const code = digits.join("");
    const { onCodeChanged } = this.props;
    if (onCodeChanged) {
      onCodeChanged(code);
    }
  };

  checkPinCodeFromClipBoard = () => {
    const { pinCount, onCodeFilled } = this.props;
    const regexp = new RegExp(`^\\d{${pinCount}}$`);
    Clipboard.getString()
      .then((code) => {
        if (
          this.hasCheckedClipBoard &&
          regexp.test(code) &&
          this.clipBoardCode !== code
        ) {
          this.setState(
            {
              digits: [...code],
            },
            () => {
              this.blurAllFields();
              this.notifyCodeChanged();
              onCodeFilled?.(code);
            }
          );
        }
        this.clipBoardCode = code;
        this.hasCheckedClipBoard = true;
      })
      .catch(() => {});
  };

  private handleChangeText = (index: number, text: string) => {
    const { onCodeFilled, pinCount } = this.props;
    const digits = this.getDigits();
    let newdigits = [...digits];
    const oldTextLength = newdigits[index] ? newdigits[index].length : 0;
    const newTextLength = text.length;
    if (newTextLength - oldTextLength === pinCount) {
      // user pasted text in.
      newdigits = [...text].slice(oldTextLength, newTextLength);
      this.setState({ digits: newdigits }, this.notifyCodeChanged);
    } else {
      if (text.length === 0) {
        if (newdigits.length > 0) {
          newdigits = newdigits.slice(0, -1);
        }
      } else {
        for (const value of text) {
          if (index < pinCount) {
            newdigits[index] = value;
            index += 1;
          }
        }
        index -= 1;
      }
      this.setState({ digits: newdigits }, this.notifyCodeChanged);
    }

    const result = newdigits.join("");
    if (result.length >= pinCount) {
      onCodeFilled?.(result);
      this.focusField(pinCount - 1);
      this.blurAllFields();
    } else if (text.length > 0 && index < pinCount - 1) {
      this.focusField(index + 1);
    }
  };

  private handleKeyPressTextInput = (index: number, key: string) => {
    const digits = this.getDigits();
    if (key === "Backspace" && !digits[index] && index > 0) {
      this.handleChangeText(index - 1, "");
      this.focusField(index - 1);
    }
  };

  public focusField = (index: number) => {
    if (index < this.fields.length) {
      (this.fields[index] as TextInput).focus();
      this.setState({
        selectedIndex: index,
      });
    }
  };

  blurAllFields = () => {
    this.fields.forEach((field: TextInput | null) =>
      (field as TextInput).blur()
    );
    this.setState({
      selectedIndex: -1,
    });
  };

  clearAllFields = () => {
    const { clearInputs, code } = this.props;
    if (clearInputs && code === "") {
      this.setState({ digits: [], selectedIndex: 0 });
    }
  };

  renderOneInputField = (index: number) => {
    const {
      codeInputFieldStyle,
      codeInputHighlightStyle,
      secureTextEntry,
      editable,
      keyboardType,
      selectionColor,
      keyboardAppearance,
    } = this.props;
    const { defaultTextFieldStyle } = styles;
    const { selectedIndex, digits } = this.state;
    const { clearInputs, placeholderCharacter, placeholderTextColor } =
      this.props;
    const { color: defaultPlaceholderTextColor } = {
      ...defaultTextFieldStyle,
      ...codeInputFieldStyle,
    };
    return (
      <View key={`${index}view`} pointerEvents="none" testID="inputSlotView">
        <TextInput
          editable={editable}
          key={index}
          keyboardAppearance={keyboardAppearance}
          keyboardType={keyboardType}
          onChangeText={(text) => {
            this.handleChangeText(index, text);
          }}
          onKeyPress={({ nativeEvent: { key } }) => {
            this.handleKeyPressTextInput(index, key);
          }}
          placeholder={placeholderCharacter}
          placeholderTextColor={
            placeholderTextColor || defaultPlaceholderTextColor
          }
          ref={(ref) => {
            this.fields[index] = ref;
          }}
          secureTextEntry={secureTextEntry}
          selectionColor={selectionColor}
          style={
            selectedIndex === index
              ? [
                  defaultTextFieldStyle,
                  codeInputFieldStyle,
                  codeInputHighlightStyle,
                ]
              : [defaultTextFieldStyle, codeInputFieldStyle]
          }
          testID="textInput"
          textContentType={isAutoFillSupported ? "oneTimeCode" : "none"}
          underlineColorAndroid="rgba(0,0,0,0)"
          value={clearInputs ? "" : digits[index]}
        />
      </View>
    );
  };

  renderTextFields = () => {
    const { pinCount } = this.props;
    const array = Array.from({ length: pinCount }).fill(0);
    return array.map((_, index) => this.renderOneInputField(index));
  };

  render() {
    const { pinCount, style, clearInputs } = this.props;
    const digits = this.getDigits();
    return (
      <View style={style} testID="OTPInputView">
        <TouchableWithoutFeedback
          onPress={() => {
            if (clearInputs) {
              this.clearAllFields();
              this.focusField(0);
            } else {
              const filledPinCount = digits.filter(
                (digit) => digit !== null && digit !== undefined
              ).length;
              this.focusField(Math.min(filledPinCount, pinCount - 1));
            }
          }}
          style={{ height: "100%", width: "100%" }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
              height: "100%",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {this.renderTextFields()}
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  }
}
