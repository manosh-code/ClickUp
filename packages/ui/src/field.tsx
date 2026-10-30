import { useId, type ChangeEvent } from "react";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  autoFocus,
}: TextFieldProps) {
  const id = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="ui-field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={6}
          onChange={handleChange}
        />
      ) : (
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={handleChange}
        />
      )}
    </label>
  );
}
