import React from 'react';
import { Character, CHARACTER_INFO } from '../types/game';
import { sound } from '../audio/sound';
import { BookOpen } from 'lucide-react';

/* O guia dos cinco primatas. Vivia embutido na mesa, atrás do véu: com
   um decreto aberto ele ficava inalcançável justo no momento em que a
   pergunta aparece — o outro declarou Gorila e você não lembra mais o
   que Gorila faz, mas fechar a janela para conferir não é opção porque
   a decisão é agora.

   Extraído daqui para virar janela que qualquer tela abre, inclusive
   por cima de outra (`over`). `focus` marca a carta que está em jogo,
   para o olho não ter que varrer as cinco. */
export const CardGuide: React.FC<{
  onClose: () => void;
  over?: boolean;
  focus?: Character;
}> = ({ onClose, over, focus }) => (
  <div className={`court-scrim${over ? ' is-over' : ''}`}>
    <div className="court-modal is-gold is-wide">
      <div className="court-modal-scroll text-left">
        <span className="court-crest">
          <span>Os cinco primatas</span>
        </span>

        <div className="space-y-2.5 mt-4">
          {(Object.keys(CHARACTER_INFO) as Character[]).map(charKey => {
            const info = CHARACTER_INFO[charKey];
            return (
              <div
                key={charKey}
                className={`court-guide-row ${focus === charKey ? 'is-on' : ''}`}
              >
                <img src={info.image} alt={info.name} className="court-guide-art" />
                <div className="flex-1 min-w-0">
                  <h4 className="court-act-name">{info.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">{info.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {info.action && <span className="court-tag is-act">{info.action}</span>}
                    {info.block && <span className="court-tag is-def">{info.block}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="court-modal-acts">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="court-btn is-stone"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* O acesso ao guia de dentro de uma janela. Discreto de propósito: é
   consulta, não decisão — não pode competir com Duvidar e Bloquear. */
export const CardGuideLink: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    className="court-guide-link"
    onClick={() => {
      sound.playClick();
      onClick();
    }}
  >
    <BookOpen className="w-3.5 h-3.5" />
    Consultar os 5 primatas
  </button>
);
