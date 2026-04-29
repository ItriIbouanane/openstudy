import type { ModalInputProps } from './types.js';

interface ModalInputBinding {
  when: (props: ModalInputProps) => boolean;
  run: (props: ModalInputProps) => void;
}

export function createHandleInput(bindings: ModalInputBinding[]) {
  return (props: ModalInputProps) => {
    const binding = bindings.find(item => item.when(props));
    if (!binding) return false;

    binding.run(props);
    return true;
  };
}

export function isPlainTextInput({ input, key }: ModalInputProps) {
  return !key.ctrl && !key.meta && !key.tab && input.length > 0;
}

export function isBackspace({ key }: ModalInputProps) {
  return key.backspace || key.delete;
}

export function isCancel({ key }: ModalInputProps) {
  return key.escape;
}

export function isSubmit({ key }: ModalInputProps) {
  return key.return;
}
