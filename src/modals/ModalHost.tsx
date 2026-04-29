import React from 'react';
import { Box } from 'ink';
import type { ActiveModal, ModalRenderContext } from './types.js';

interface ModalHostProps {
  modal: ActiveModal;
  termWidth: number;
  termHeight: number;
  context: ModalRenderContext;
}

export const ModalHost: React.FC<ModalHostProps> = ({ modal, termWidth, termHeight, context }) => {
  const width = Math.min(60, Math.max(1, termWidth - 4));
  const height = modal.module.getHeight(modal.state);
  const top = Math.max(0, Math.floor((termHeight - height) / 2));
  const left = Math.max(0, Math.floor((termWidth - width) / 2));

  return (
    <Box position="absolute" top={top} left={left} width={width}>
      <Box
        width={width}
        flexDirection="column"
        borderStyle="single"
        borderColor="#303036"
        backgroundColor="#101014"
        paddingX={2}
        paddingY={1}
      >
        {modal.module.render({ modal: modal.state, context })}
      </Box>
    </Box>
  );
};
