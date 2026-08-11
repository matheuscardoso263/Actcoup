class SoundEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playCoin() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
    osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playCardFlip() {
    this.init();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.Q.setValueAtTime(3, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  /** Duas lâminas se encontrando: o choque que abre a cena de desafio. */
  playChallenge() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Transiente metálico. Bandpass alto e Q apertado transforma ruído branco
    // em "aço"; sem isso o choque soa como um tapa em papelão.
    const noise = this.createNoise(0.35);
    if (noise) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(2.2, now);
      filter.frequency.setValueAtTime(3600, now);
      filter.frequency.exponentialRampToValueAtTime(900, now + 0.3);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    // Parciais inarmônicas curtas = ressonância do metal depois da batida.
    for (const [freq, level, decay] of [
      [1840, 0.1, 0.42],
      [2610, 0.07, 0.3],
      [3970, 0.045, 0.2]
    ] as Array<[number, number, number]>) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + decay);
    }

    // O peso embaixo. Sem esta camada o choque fica fino e não "acerta".
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(180, now);
    boom.frequency.exponentialRampToValueAtTime(45, now + 0.4);
    boomGain.gain.setValueAtTime(0.4, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    boom.connect(boomGain);
    boomGain.connect(this.ctx.destination);
    boom.start(now);
    boom.stop(now + 0.5);
  }

  /** Veredito a favor do acusado: a carta existia mesmo. Fanfarra curta. */
  playTruth() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Tríade maior subindo — a leitura cultural de "deu certo".
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, index) => {
      const at = now + index * 0.075;
      // Fundamental + oitava suave: dá brilho sem virar apito.
      for (const [ratio, level] of [
        [1, 0.2],
        [2, 0.06]
      ] as Array<[number, number]>) {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * ratio, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(at);
        osc.stop(at + 0.7);
      }
    });
  }

  /** Veredito contra o acusado: era blefe. Trítono descendo, desconfortável. */
  playBluff() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Trítono (a "quarta aumentada" que a música antiga chamava de diabolus)
    // com as duas vozes desafinadas entre si: soa errado de propósito.
    for (const [freq, detune] of [
      [415.3, 0],
      [293.66, 14],
      [207.65, -11]
    ] as Array<[number, number]>) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.detune.setValueAtTime(detune, now);
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.75);

      // Filtro fechando junto com a queda: o som "afunda" em vez de só sumir.
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.7);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    }

    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, now);
    thud.frequency.exponentialRampToValueAtTime(36, now + 0.45);
    thudGain.gain.setValueAtTime(0.35, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    thud.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thud.start(now);
    thud.stop(now + 0.55);
  }

  /** Escudo aparando o golpe: badalada metálica curta e grave. */
  playBlock() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const noise = this.createNoise(0.2);
    if (noise) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(1.1, now);
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.18);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.26, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    // Mesma receita do sino do selo, uma oitava acima e com decaimento curto:
    // aqui é chapa de metal, não sino de igreja.
    const root = 233.08; // Bb3
    for (const [ratio, level, decay] of [
      [1, 0.24, 1.1],
      [2.4, 0.13, 0.75],
      [3.9, 0.07, 0.5],
      [5.4, 0.04, 0.32]
    ] as Array<[number, number, number]>) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(root * ratio, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + decay);
    }
  }

  /** Carta deslizando do baralho para a mesa. */
  playDeal() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const noise = this.createNoise(0.16);
    if (!noise) return;

    // Highpass em vez do bandpass da virada: a carta escorregando pelo feltro
    // é só sopro, sem o "tec" do papel batendo.
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + 0.13);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playVictory() {
    this.init();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.25, this.ctx!.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(this.ctx!.currentTime + idx * 0.12);
      osc.stop(this.ctx!.currentTime + idx * 0.12 + 0.4);
    });
  }

  /**
   * Coroação. O playVictory acima é um arpejo de quatro notas — serve pra um
   * acerto pequeno, não pra encerrar a partida. Aqui são três camadas: o sino
   * grave da corte anunciando, a fanfarra resolvendo da dominante na tônica, e
   * um sustentado grave por baixo segurando tudo.
   */
  playCoronation() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. O sino. Mesmas parciais inarmônicas do selo de cera — é o mesmo
    //    instrumento da corte, agora tocando a favor de alguém.
    const root = 130.81; // C3
    for (const [ratio, level, decay] of [
      [1, 0.2, 3.4],
      [2, 0.11, 2.4],
      [2.76, 0.075, 1.6],
      [4.07, 0.04, 1.0]
    ] as Array<[number, number, number]>) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(root * ratio, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + decay);
    }

    // 2. A fanfarra. Sol maior puxando para dó maior: é a cadência que o
    //    ouvido ocidental lê como "acabou, e acabou bem".
    const chords: Array<[at: number, hold: number, freqs: number[]]> = [
      [0.0, 0.42, [392.0, 493.88, 587.33]], // G4 B4 D5
      [0.36, 2.2, [523.25, 659.25, 783.99, 1046.5]] // C5 E5 G5 C6
    ];

    for (const [offset, hold, freqs] of chords) {
      const at = now + offset;
      for (const freq of freqs) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Metal de sopro: dente de serra é cru demais sozinho, então um
        // lowpass abre no ataque e fecha no sustentado — é o que dá o "sopro".
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, at);
        filter.frequency.exponentialRampToValueAtTime(4200, at + 0.06);
        filter.frequency.exponentialRampToValueAtTime(1500, at + hold);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, at);
        // Vozes ligeiramente desafinadas entre si engrossam o naipe.
        osc.detune.setValueAtTime((Math.random() - 0.5) * 9, at);

        // Dividido pelo número de vozes: um acorde de 4 notas com o mesmo
        // ganho de uma nota só satura a saída.
        const level = 0.13 / Math.sqrt(freqs.length);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(level, at + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + hold);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(at);
        osc.stop(at + hold);
      }
    }

    // 3. O chão. Não se ouve isoladamente, mas sem ele a cena fica sem peso.
    const bass = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(65.41, now); // C2
    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(0.3, now + 0.12);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    bass.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bass.start(now);
    bass.stop(now + 2.6);
  }

  /** Ruído branco cru — base dos efeitos de sopro/corte. */
  private createNoise(seconds: number): AudioBufferSourceNode | null {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  /** Lâmina cortando o ar: ruído filtrado descendo + estalo grave. */
  playSlash() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const noise = this.createNoise(0.3);
    if (noise) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(1.4, now);
      filter.frequency.setValueAtTime(5200, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.26);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.16);
    oscGain.gain.setValueAtTime(0.18, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Impacto grave, para o baque logo depois do corte. */
  playThud() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /** Selo de cera batendo no decreto + sino grave da corte (deposição). */
  playSeal() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. O impacto do carimbo: estalo abafado, sem brilho nenhum.
    const noise = this.createNoise(0.25);
    if (noise) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.2);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.34, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    }

    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = 'sine';
    punch.frequency.setValueAtTime(110, now);
    punch.frequency.exponentialRampToValueAtTime(32, now + 0.3);
    punchGain.gain.setValueAtTime(0.45, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    punch.connect(punchGain);
    punchGain.connect(this.ctx.destination);
    punch.start(now);
    punch.stop(now + 0.4);

    // 2. O sino. Parciais inarmônicas (não múltiplos inteiros) são o que
    //    diferencia um sino de um seno puro; cada uma decai num tempo
    //    diferente, e a fundamental é a que sustenta.
    const bell: Array<[ratio: number, gain: number, decay: number]> = [
      [1, 0.22, 2.8],
      [2, 0.12, 2.0],
      [2.76, 0.09, 1.4],
      [4.07, 0.05, 0.9]
    ];
    const root = 132;
    const strike = now + 0.06;

    for (const [ratio, level, decay] of bell) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(root * ratio, strike);
      gain.gain.setValueAtTime(0.0001, strike);
      gain.gain.exponentialRampToValueAtTime(level, strike + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, strike + decay);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(strike);
      osc.stop(strike + decay);
    }
  }

  playError() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}

export const sound = new SoundEffects();
