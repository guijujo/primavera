/* =============================================================
   FLORES AMARILLAS PARA NAZA 🌻
   script.js — Three.js + JavaScript puro (sin frameworks)

   Índice:
     0. Texto de la carta (EDITALO ACÁ)
     1. Ajustes generales
     2. Referencias del DOM y estado
     3. Escena, cámara, luces
     4. Geometría de la flor (pétalos, corazón, tallo, hojas)
     5. Armado del ramo
     6. Polen flotante (partículas)
     7. Composición responsive y resize
     8. Bucle de animación (florecimiento + vaivén)
     9. Carta con efecto máquina de escribir
    10. Clave de 4 dígitos
    11. Música y apertura del regalo
   ============================================================= */

(function () {
  'use strict';

  /* =============================================================
     0. TEXTO DE LA CARTA  ✏️  ← EDITÁ ESTAS LÍNEAS
     Cada string del array es un párrafo. Se escriben uno tras otro
     con efecto de máquina de escribir. Podés agregar o quitar los
     que quieras; el resto del código se adapta solo.
     ============================================================= */
  const CARTA = [
    'Hoy vuelve a empezar la primavera, pero esta es la primera que empieza con vos.',
    'Dicen que las flores amarillas se regalan para decir "quiero seguir eligiéndote". Yo te las quiero dar todos los días, aunque no sea 21 de septiembre.',
    'No sé hacer que un ramo dure para siempre, así que te hice uno que no se marchita: florece cada vez que abras esta página, igual que me pasa a mí cada vez que te veo llegar.',
    'Gracias por pintar de amarillo hasta los días grises, por tu risa, y por hacer que las cosas simples se sientan enormes.',
    'Feliz primavera, mi amor. Te amo. 🌻',
  ];

  /* =============================================================
     1. AJUSTES GENERALES
     ============================================================= */
  const CONFIG = {
    // --- clave de la carta ---  ✏️ ← CAMBIALA ACÁ
    clave: '2507',                // podés usar más o menos dígitos: se adapta sola
    pista: 'Pista: una fecha nuestra 💛',   // aparece tras 3 intentos ('' = sin pista)
    // --- florecimiento ---
    duracionFlorecimiento: 2.6,   // segundos que tarda una flor en abrirse
    // --- carta ---
    msPorLetra: 32,               // velocidad de la máquina de escribir
    msPausaParrafo: 620,          // pausa entre párrafos
    // --- escena ---
    colorPetaloA: 0xffc93c,       // amarillo principal
    colorPetaloB: 0xffa726,       // corona interior (un poco más naranja)
    colorTallo: 0x4c7a3f,
    puntoQuiebre: 900,            // mismo breakpoint que styles.css
  };

  // Detectamos si el dispositivo es "modesto" para bajar la calidad
  const ESMOVIL = window.matchMedia('(max-width: ' + (CONFIG.puntoQuiebre - 1) + 'px)').matches;
  const MENOS_MOVIMIENTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Definición de cada flor del ramo: posición, tamaño y retardo de apertura
  const RAMO = [
    { x:  0.00, z:  0.00, alto: 3.00, escala: 1.00, giro:  0.00, retardo: 0.00, color: CONFIG.colorPetaloA },
    { x: -1.75, z: -0.85, alto: 2.45, escala: 0.86, giro:  0.90, retardo: 0.45, color: 0xffb62b },
    { x:  1.70, z: -0.55, alto: 2.15, escala: 0.78, giro: -0.70, retardo: 0.80, color: 0xffd95e },
  ];

  /* =============================================================
     2. REFERENCIAS DEL DOM Y ESTADO
     ============================================================= */
  const $ = (id) => document.getElementById(id);
  const canvas   = $('scene');
  const welcome  = $('welcome');
  const btnOpen  = $('btn-open');
  const btnAudio = $('btn-audio');
  const audio    = $('bgm');
  const card     = $('card');
  const letter   = $('letter');
  const sign     = $('sign');
  const hint     = $('hint');
  const toastEl  = $('toast');
  const lock      = $('lock');
  const lockPanel = $('lock-panel');
  const lockDots  = $('lock-dots');
  const lockMsg   = $('lock-msg');
  const keypad    = $('keypad');

  const estado = {
    abierto: false,       // ¿ya se abrió el regalo?
    t0: 0,                // instante en que arrancó el florecimiento
    tiempo: 0,            // reloj propio acumulado
    visible: true,        // pestaña visible
    corriendo: false,     // ¿el bucle de render está activo?
    audioOk: true,
  };

  // Si Three.js no cargó (sin internet la primera vez), avisamos y salimos
  // ANTES de tocar cualquier cosa de la librería.
  if (typeof THREE === 'undefined') {
    avisar('No se pudo cargar Three.js. Conectate a internet una vez y volvé a abrir la página 🌐', 12000);
    welcome.addEventListener('click', () => welcome.classList.add('is-hidden'));
    return;
  }

  let renderer, escena, camara, ramo, polen, planoSombra;
  const objetivo = new THREE.Vector3();        // hacia dónde mira la cámara
  const camaraBase = new THREE.Vector3();      // posición de reposo de la cámara
  const puntero = { x: 0, y: 0 };              // parallax suave con mouse/dedo
  const reloj = new THREE.Clock();

  /* =============================================================
     3. ESCENA, CÁMARA Y LUCES
     ============================================================= */
  function iniciarEscena() {
    // --- Renderer: alpha:true deja ver el degradado CSS del body ---
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: window.devicePixelRatio < 1.5,  // en pantallas HiDPI no hace falta
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Sombras suaves
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Tono cinematográfico: comprime las luces altas y da el brillo dorado.
    // (No tocamos outputEncoding a propósito: con las versiones "legacy" de
    //  Three.js lava los colores y las flores salen casi blancas.)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    escena = new THREE.Scene();
    // Niebla muy sutil: las flores del fondo se funden con la noche
    escena.fog = new THREE.Fog(0x0b0f0c, 9, 26);

    camara = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);

    // ---------- LUCES ----------
    // Ambiente frío: llena las sombras sin apagar el dorado
    escena.add(new THREE.AmbientLight(0x6f86ad, 0.48));

    // Luz clave (sol tibio): la que genera las sombras y el relieve
    const clave = new THREE.DirectionalLight(0xffeec4, 1.55);
    clave.position.set(4.5, 7.5, 5.0);
    clave.castShadow = true;
    const mapa = ESMOVIL ? 1024 : 2048;
    clave.shadow.mapSize.set(mapa, mapa);
    clave.shadow.camera.near = 1;
    clave.shadow.camera.far = 24;
    clave.shadow.camera.left = -6;
    clave.shadow.camera.right = 6;
    clave.shadow.camera.top = 7;
    clave.shadow.camera.bottom = -3;
    clave.shadow.bias = -0.0009;
    clave.shadow.radius = 3;
    escena.add(clave);

    // Luz de relleno azulada desde atrás: recorta la silueta de los pétalos
    const relleno = new THREE.DirectionalLight(0x9cc6ff, 0.40);
    relleno.position.set(-5, 2.5, -4);
    escena.add(relleno);

    // Punto cálido delante del ramo: da ese brillo dorado a los pétalos
    const calida = new THREE.PointLight(0xffa93a, 1.15, 16, 1);
    calida.position.set(0.5, 2.2, 3.2);
    escena.add(calida);

    // ---------- CONTENEDOR DEL RAMO ----------
    ramo = new THREE.Group();
    ramo.visible = false;               // aparece recién al abrir el regalo
    escena.add(ramo);

    // Suelo invisible que SOLO recibe sombras (ShadowMaterial)
    planoSombra = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ opacity: 0.3 })
    );
    planoSombra.rotation.x = -Math.PI / 2;
    planoSombra.position.y = -0.02;
    planoSombra.receiveShadow = true;
    ramo.add(planoSombra);

    // ---------- FLORES ----------
    RAMO.forEach((def) => {
      const flor = crearFlor(def);
      flor.position.set(def.x, 0, def.z);
      flor.rotation.y = def.giro;
      ramo.add(flor);
    });

    // ---------- POLEN ----------
    polen = crearPolen(ESMOVIL ? 160 : 320);
    escena.add(polen);

    actualizarComposicion();
    camara.updateProjectionMatrix();
  }

  /* =============================================================
     4. GEOMETRÍA DE LA FLOR
     Todo se genera con matemática: curvas de Bézier para el contorno
     del pétalo, extrusión para darle volumen, y una deformación
     manual de los vértices para curvarlo y ahuecarlo.
     ============================================================= */

  /**
   * Crea la geometría de UN pétalo.
   * 1) Dibujamos medio contorno con curvas de Bézier y lo espejamos:
   *    nace angosto en la base (0,0) y termina en punta en (0, largo).
   * 2) ExtrudeGeometry le da espesor + bisel (bordes redondeados que
   *    atrapan la luz y hacen el relieve dorado).
   * 3) Recorremos los vértices para curvar, ahuecar y torsionar.
   */
  function crearGeometriaPetalo(opciones) {
    const o = Object.assign({
      largo: 1.35, ancho: 0.42, curva: 0.35, canal: 0.55, torsion: 0.18, segmentos: 16,
    }, opciones);

    const contorno = new THREE.Shape();
    contorno.moveTo(0, 0);
    // lado derecho: sube desde la base ensanchándose
    contorno.bezierCurveTo(o.ancho * 0.85, o.largo * 0.12, o.ancho, o.largo * 0.55, o.ancho * 0.30, o.largo * 0.93);
    // punta redondeada (no en pico: así el pétalo se ve carnoso)
    contorno.quadraticCurveTo(0, o.largo * 1.05, -o.ancho * 0.30, o.largo * 0.93);
    // lado izquierdo: espejo del derecho, de vuelta a la base
    contorno.bezierCurveTo(-o.ancho, o.largo * 0.55, -o.ancho * 0.85, o.largo * 0.12, 0, 0);

    const geo = new THREE.ExtrudeGeometry(contorno, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: o.segmentos,
    });

    // --- Deformación de los vértices: acá el pétalo deja de ser plano ---
    // Y de paso pintamos un degradado por vértice: la base más anaranjada
    // y la punta más clara, como en los girasoles de verdad.
    const pos = geo.attributes.position;
    const colores = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      let z = pos.getZ(i);

      const t = Math.max(0, Math.min(1, y / o.largo));   // 0 en la base, 1 en la punta

      z += o.curva * t * t;                 // la punta se inclina hacia afuera
      z -= o.canal * x * x;                 // los bordes se levantan: sección en "U"

      // Torsión suave alrededor del eje del pétalo (nada es perfectamente simétrico)
      const a = o.torsion * t;
      const cos = Math.cos(a), sen = Math.sin(a);
      pos.setXYZ(i, x * cos + z * sen, y, -x * sen + z * cos);

      // Estos valores MULTIPLICAN al color del material
      colores[i * 3 + 0] = 0.86 + 0.20 * t;
      colores[i * 3 + 1] = 0.66 + 0.40 * t;
      colores[i * 3 + 2] = 0.50 + 0.55 * t;
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    geo.computeVertexNormals();             // recalculamos normales o la luz se ve mal
    return geo;
  }

  /**
   * Corona de pétalos: N copias del mismo pétalo, cada una dentro de un
   * pivote girado alrededor del eje Y de la flor (360° / cantidad).
   */
  function agregarCorona(cabeza, lista, o) {
    for (let i = 0; i < o.cantidad; i++) {
      const pivote = new THREE.Object3D();
      pivote.rotation.y = o.desfase + (i / o.cantidad) * Math.PI * 2;

      const petalo = new THREE.Mesh(o.geometria, o.material);
      petalo.position.z = o.radio;                       // se apoya en el borde del corazón
      petalo.castShadow = true;
      petalo.receiveShadow = true;

      // Pequeñas variaciones para que no parezca clonado a máquina
      const inclinacion = o.inclinacion + (Math.random() - 0.5) * 0.14;
      const escala = o.escala * (0.92 + Math.random() * 0.16);

      // rotation.x = 90° deja el pétalo horizontal; le restamos la inclinación
      // para levantarlo. Guardamos el valor final: el florecimiento interpola
      // desde "capullo cerrado" hasta este objetivo.
      petalo.rotation.x = Math.PI / 2 - inclinacion;
      petalo.scale.setScalar(escala);
      petalo.userData.inclinacion = inclinacion;
      petalo.userData.escala = escala;

      pivote.add(petalo);
      cabeza.add(pivote);
      lista.push(petalo);
    }
  }

  /**
   * Corazón de la flor: una cúpula + semillas distribuidas con el
   * ÁNGULO ÁUREO (137.5°), la misma espiral de Fibonacci que usan los
   * girasoles de verdad. Se dibujan con un InstancedMesh: cientos de
   * semillas en una sola llamada de render.
   */
  function crearCorazon(radio) {
    const grupo = new THREE.Group();

    const matBase = new THREE.MeshStandardMaterial({ color: 0x6b3d14, roughness: 0.85, metalness: 0.05 });
    const cupula = new THREE.Mesh(
      new THREE.SphereGeometry(radio, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      matBase
    );
    cupula.scale.y = 0.45;
    cupula.castShadow = true;
    cupula.receiveShadow = true;
    grupo.add(cupula);

    const cantidad = ESMOVIL ? 70 : 120;
    const ANGULO_AUREO = Math.PI * (3 - Math.sqrt(5));  // ≈ 137.5°
    const semillas = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(radio * 0.085, 0),
      new THREE.MeshStandardMaterial({ color: 0x8c5a1e, roughness: 0.7, metalness: 0.15, flatShading: true }),
      cantidad
    );
    semillas.castShadow = true;

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();

    for (let i = 0; i < cantidad; i++) {
      const r = radio * 0.94 * Math.sqrt(i / cantidad);   // sqrt reparte áreas iguales
      const a = i * ANGULO_AUREO;
      const altura = radio * 0.45 * Math.sqrt(Math.max(0, 1 - (r / radio) * (r / radio)));
      p.set(Math.cos(a) * r, altura, Math.sin(a) * r);
      e.set(Math.random() * 3, a, Math.random() * 3);
      q.setFromEuler(e);
      const k = 0.75 + Math.random() * 0.45;
      s.set(k, k, k);
      semillas.setMatrixAt(i, m.compose(p, q, s));
    }
    semillas.instanceMatrix.needsUpdate = true;
    grupo.add(semillas);

    return grupo;
  }

  /**
   * Tallo: una curva Catmull-Rom (suave, con una ligera "S") convertida
   * en un tubo. Devuelve también la curva para poder colgar las hojas
   * en puntos exactos con curva.getPointAt(t).
   * (Alternativa más simple: un CylinderGeometry recto.)
   */
  function crearTallo(alto, curvatura, material) {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(curvatura * 0.9, 0, 0.25),
      new THREE.Vector3(curvatura * 0.4, alto * 0.33, 0.12),
      new THREE.Vector3(-curvatura * 0.3, alto * 0.66, -0.05),
      new THREE.Vector3(0, alto, 0),
    ]);
    const geo = new THREE.TubeGeometry(curva, ESMOVIL ? 28 : 48, 0.052, ESMOVIL ? 6 : 10, false);
    const malla = new THREE.Mesh(geo, material);
    malla.castShadow = true;
    malla.receiveShadow = true;
    return { malla: malla, curva: curva };
  }

  /** Hoja: mismo truco que el pétalo (contorno + extrusión + curvado). */
  function crearGeometriaHoja() {
    return crearGeometriaPetalo({ largo: 1.0, ancho: 0.34, curva: 0.28, canal: 0.35, torsion: 0.5, segmentos: 12 });
  }

  // --- Geometrías y materiales compartidos (se crean UNA vez) ---
  const GEO = {
    petaloExterno: null,
    petaloInterno: null,
    hoja: null,
  };
  const MAT = {
    tallo: null,
    hoja: null,
    petalos: {},   // cache por color
  };

  function prepararRecursos() {
    GEO.petaloExterno = crearGeometriaPetalo({ largo: 1.55, ancho: 0.46, curva: 0.40, canal: 0.42, torsion: 0.18, segmentos: ESMOVIL ? 12 : 18 });
    GEO.petaloInterno = crearGeometriaPetalo({ largo: 1.05, ancho: 0.34, curva: 0.30, canal: 0.6, torsion: -0.22, segmentos: ESMOVIL ? 10 : 16 });
    GEO.hoja = crearGeometriaHoja();

    MAT.tallo = new THREE.MeshStandardMaterial({ color: CONFIG.colorTallo, roughness: 0.78, metalness: 0.05 });
    MAT.hoja  = new THREE.MeshStandardMaterial({ color: 0x5f9145, roughness: 0.68, metalness: 0.08, side: THREE.DoubleSide });
  }

  /** Material dorado del pétalo (reutiliza el mismo si el color se repite). */
  function materialPetalo(color) {
    if (!MAT.petalos[color]) {
      MAT.petalos[color] = new THREE.MeshStandardMaterial({
        color: color,
        vertexColors: true,       // usa el degradado base→punta
        roughness: 0.34,          // bajo = brillo satinado
        metalness: 0.22,          // toque metálico → acabado dorado
        emissive: 0xff8c00,       // autoiluminación tenue: "brilla" en la noche
        emissiveIntensity: 0.10,
        side: THREE.DoubleSide,   // los pétalos son finos: se ven de los dos lados
      });
    }
    return MAT.petalos[color];
  }

  /* =============================================================
     5. ARMADO DE UNA FLOR COMPLETA
     El origen del grupo está en la BASE del tallo, así el vaivén y
     el florecimiento (escala 0 → 1) nacen desde el suelo.
     ============================================================= */
  function crearFlor(def) {
    const flor = new THREE.Group();
    const petalos = [];

    // --- Tallo ---
    const tallo = crearTallo(def.alto, 0.28, MAT.tallo);
    flor.add(tallo.malla);

    // --- Hojas colgadas de la curva del tallo ---
    [0.33, 0.58].forEach((t, i) => {
      const hoja = new THREE.Mesh(GEO.hoja, MAT.hoja);
      const punto = tallo.curva.getPointAt(t);
      hoja.position.copy(punto);
      hoja.rotation.set(
        Math.PI / 2 - 0.55,                       // caída hacia afuera
        (i === 0 ? 1 : -1) * (1.1 + Math.random() * 0.4),  // una para cada lado
        (i === 0 ? 1 : -1) * 0.35
      );
      hoja.scale.setScalar(0.85 - i * 0.15);
      hoja.castShadow = true;
      hoja.receiveShadow = true;
      flor.add(hoja);
    });

    // --- Cabeza de la flor, en la punta del tallo ---
    const cabeza = new THREE.Group();
    cabeza.position.set(0, def.alto, 0);
    cabeza.rotation.x = 0.34;    // se asoma hacia quien mira
    cabeza.rotation.z = 0.08;

    const radioCorazon = 0.42;
    cabeza.add(crearCorazon(radioCorazon));

    // Cáliz verde por detrás (tapa la unión entre pétalos y tallo)
    const caliz = new THREE.Mesh(new THREE.SphereGeometry(radioCorazon * 0.92, 20, 12), MAT.hoja);
    caliz.scale.y = 0.32;
    caliz.position.y = -0.11;
    caliz.castShadow = true;
    cabeza.add(caliz);

    // Dos coronas de pétalos: la interna va desfasada media posición
    agregarCorona(cabeza, petalos, {
      cantidad: 10, geometria: GEO.petaloExterno, material: materialPetalo(def.color),
      inclinacion: 0.20, escala: 1.0, desfase: 0, radio: radioCorazon * 0.80,
    });
    agregarCorona(cabeza, petalos, {
      cantidad: 8, geometria: GEO.petaloInterno, material: materialPetalo(CONFIG.colorPetaloB),
      inclinacion: 0.70, escala: 0.95, desfase: Math.PI / 8, radio: radioCorazon * 0.55,
    });

    flor.add(cabeza);

    // Datos que necesita el bucle de animación
    flor.userData = {
      cabeza: cabeza,
      petalos: petalos,
      retardo: def.retardo,
      escalaFinal: def.escala,
      fase: Math.random() * Math.PI * 2,   // desfase del vaivén
      giroCabeza: cabeza.rotation.y,
    };

    flor.scale.setScalar(0.0001);          // arranca cerrada (invisible)
    return flor;
  }

  /* =============================================================
     6. POLEN FLOTANTE (partículas)
     ============================================================= */
  function texturaPunto() {
    // Generamos la textura con Canvas 2D: un puntito suave, sin archivos externos
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,225,150,0.75)');
    g.addColorStop(1.0, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function crearPolen(cantidad) {
    const geo = new THREE.BufferGeometry();
    const posiciones = new Float32Array(cantidad * 3);
    const velocidades = new Float32Array(cantidad);
    const semillas = new Float32Array(cantidad);

    for (let i = 0; i < cantidad; i++) {
      posiciones[i * 3 + 0] = (Math.random() - 0.5) * 20;
      posiciones[i * 3 + 1] = Math.random() * 12 - 2;
      posiciones[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
      velocidades[i] = 0.12 + Math.random() * 0.35;      // sube lento
      semillas[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));

    const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.09,
      map: texturaPunto(),
      color: 0xffd98a,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,                     // no tapan a las flores
      blending: THREE.AdditiveBlending,      // se suman como luz
      sizeAttenuation: true,
    }));
    puntos.userData = { velocidades: velocidades, semillas: semillas, cantidad: cantidad };
    return puntos;
  }

  function animarPolen(dt) {
    const attr = polen.geometry.attributes.position;
    const { velocidades, semillas, cantidad } = polen.userData;
    for (let i = 0; i < cantidad; i++) {
      const j = i * 3;
      attr.array[j + 1] += velocidades[i] * dt;                                   // flota hacia arriba
      attr.array[j] += Math.sin(estado.tiempo * 0.6 + semillas[i]) * 0.12 * dt;   // deriva lateral
      if (attr.array[j + 1] > 10) attr.array[j + 1] = -2.5;                        // vuelve abajo
    }
    attr.needsUpdate = true;
  }

  /* =============================================================
     7. COMPOSICIÓN RESPONSIVE + RESIZE
     ============================================================= */
  const RADIO_RAMO = 3.3;   // medio ancho del ramo en unidades de la escena
  const ALTO_FLOR  = 3.0;   // altura de la flor principal (ver RAMO[0].alto)

  function actualizarComposicion() {
    const escritorio = window.innerWidth >= CONFIG.puntoQuiebre;
    camara.aspect = window.innerWidth / window.innerHeight;

    if (escritorio) {
      // Pantalla ancha: la carta va a la izquierda, el ramo a la derecha
      camaraBase.set(0.7, 0.9, 7.3);
      objetivo.set(1.7, 0.5, 0);
      ramo.position.x = 1.9;
    } else {
      // Vertical (celular): el ramo arriba, la carta abajo
      camaraBase.set(0, 1.0, 8.8);
      objetivo.set(0, 0.6, 0);
      ramo.position.x = 0;
    }

    // --- El ramo se achica lo justo para entrar SIEMPRE en el ancho visible ---
    // ancho visible a la altura del ramo = 2 · tan(fov/2) · distancia · aspecto
    const tan = Math.tan((camara.fov / 2) * Math.PI / 180);
    const anchoVisible = 2 * tan * camaraBase.z * camara.aspect;
    let k = anchoVisible / (2 * RADIO_RAMO);
    k = Math.max(0.42, Math.min(1, k));
    ramo.scale.setScalar(k);

    // Y lo subimos para que la flor principal quede en el tercio superior
    // (así la carta, que va abajo, nunca la tapa).
    ramo.position.y = (escritorio ? 2.0 : 1.9) - k * ALTO_FLOR;
    ramo.position.z = 0;

    camara.position.copy(camaraBase);
    camara.lookAt(objetivo);
  }

  function ajustarTamano() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    actualizarComposicion();          // recalcula aspect, encuadre y escala
    camara.updateProjectionMatrix();  // ← imprescindible tras cambiar el aspect
  }

  // El resize se agrupa en un requestAnimationFrame (evita recalcular de más)
  let resizePendiente = false;
  window.addEventListener('resize', function () {
    if (resizePendiente) return;
    resizePendiente = true;
    requestAnimationFrame(function () {
      resizePendiente = false;
      ajustarTamano();
    });
  });
  window.addEventListener('orientationchange', () => setTimeout(ajustarTamano, 250));

  // Pausamos el render si la pestaña no se ve (ahorra batería en el celu)
  document.addEventListener('visibilitychange', function () {
    estado.visible = !document.hidden;
    if (estado.visible) arrancarBucle();
  });

  // Parallax suave: la cámara sigue apenas al mouse / al dedo
  function moverPuntero(x, y) {
    puntero.x = (x / window.innerWidth) * 2 - 1;
    puntero.y = (y / window.innerHeight) * 2 - 1;
  }
  window.addEventListener('pointermove', (e) => moverPuntero(e.clientX, e.clientY), { passive: true });

  /* =============================================================
     8. BUCLE DE ANIMACIÓN
     ============================================================= */

  // Easings (curvas de suavizado)
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => {            // se pasa un poquito y vuelve: rebote vivo
    const c1 = 1.20158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const mezclar = (a, b, t) => a + (b - a) * t;

  function animarFlores(dt) {
    ramo.children.forEach(function (flor) {
      const d = flor.userData;
      if (!d || !d.petalos) return;   // salteamos el plano de sombra

      // --- Progreso del florecimiento de ESTA flor ---
      const p = estado.abierto
        ? clamp01((estado.tiempo - estado.t0 - d.retardo) / CONFIG.duracionFlorecimiento)
        : 0;

      // 1) El tallo crece desde el suelo (escala 0 → 1 con rebote)
      const crecer = easeOutBack(clamp01(p / 0.75));
      flor.scale.setScalar(Math.max(0.0001, d.escalaFinal * crecer));

      // 2) Los pétalos se abren: de capullo cerrado a su inclinación final
      const abrir = easeOutCubic(clamp01((p - 0.3) / 0.7));
      for (let i = 0; i < d.petalos.length; i++) {
        const petalo = d.petalos[i];
        const inclinacion = mezclar(1.45, petalo.userData.inclinacion, abrir);  // 1.45 rad ≈ cerrado
        petalo.rotation.x = Math.PI / 2 - inclinacion;
        petalo.scale.setScalar(petalo.userData.escala * mezclar(0.25, 1, abrir));
      }

      // 3) La cabeza gira un poco mientras se abre (efecto "se despereza")
      d.cabeza.rotation.y = d.giroCabeza + (1 - abrir) * -1.0;

      // 4) Vaivén permanente: la flor respira con una brisa imaginaria
      if (!MENOS_MOVIMIENTO) {
        const t = estado.tiempo;
        flor.rotation.z = Math.sin(t * 0.75 + d.fase) * 0.035;
        flor.rotation.x = Math.cos(t * 0.55 + d.fase) * 0.025;
        d.cabeza.rotation.z = 0.08 + Math.sin(t * 0.9 + d.fase) * 0.05;
      }
    });

    // Rotación suave de todo el ramo
    if (!MENOS_MOVIMIENTO) ramo.rotation.y += dt * 0.09;
  }

  function bucle() {
    if (!estado.visible) { estado.corriendo = false; return; }  // oculta: no gastamos GPU
    requestAnimationFrame(bucle);

    const dt = Math.min(reloj.getDelta(), 0.05);    // cap: evita saltos tras un lag
    estado.tiempo += dt;

    animarFlores(dt);
    animarPolen(dt);
    pasoMaquina(dt * 1000);

    // Parallax: la cámara persigue con suavidad su posición objetivo
    const fuerza = MENOS_MOVIMIENTO ? 0 : 1;
    camara.position.x += (camaraBase.x + puntero.x * 0.75 * fuerza - camara.position.x) * 0.05;
    camara.position.y += (camaraBase.y - puntero.y * 0.45 * fuerza - camara.position.y) * 0.05;
    camara.lookAt(objetivo);

    renderer.render(escena, camara);
  }

  /** Arranca el bucle (una sola vez: nunca dos rAF en paralelo). */
  function arrancarBucle() {
    if (estado.corriendo) return;
    estado.corriendo = true;
    reloj.getDelta();      // descartamos el tiempo que pasó con la pestaña oculta
    requestAnimationFrame(bucle);
  }

  /* =============================================================
     9. CARTA CON EFECTO MÁQUINA DE ESCRIBIR
     ============================================================= */
  const maquina = {
    activa: false,
    terminada: false,
    parrafo: 0,
    letra: 0,
    acumulado: 0,
    proximo: 0,
    nodo: null,          // nodo de texto que vamos llenando
    cursor: null,
  };

  function pasoMaquina(dtMs) {
    if (!maquina.activa || maquina.terminada) return;

    maquina.acumulado += dtMs;
    let guardia = 0;     // por si la pestaña estuvo quieta: no escribimos 5000 letras de golpe

    while (maquina.acumulado >= maquina.proximo && guardia++ < 60) {
      maquina.acumulado -= maquina.proximo;

      // ¿Hay que empezar un párrafo nuevo?
      if (!maquina.nodo) {
        if (maquina.parrafo >= CARTA.length) { terminarCarta(); return; }
        const p = document.createElement('p');
        maquina.nodo = document.createTextNode('');
        p.appendChild(maquina.nodo);
        p.appendChild(maquina.cursor);
        letter.appendChild(p);
        maquina.letra = 0;
      }

      const texto = CARTA[maquina.parrafo];

      if (maquina.letra < texto.length) {
        const ch = texto.charAt(maquina.letra++);
        maquina.nodo.nodeValue += ch;
        // Ritmo humano: pausas más largas en la puntuación
        let espera = CONFIG.msPorLetra;
        if (ch === ',' || ch === ';' || ch === ':') espera += 180;
        else if (ch === '.' || ch === '!' || ch === '?') espera += 340;
        maquina.proximo = espera;
        seguirEscritura();     // la carta acompaña al texto mientras se escribe
      } else {
        // Párrafo listo → pasamos al siguiente
        maquina.parrafo++;
        maquina.nodo = null;
        maquina.proximo = CONFIG.msPausaParrafo;
        if (maquina.parrafo >= CARTA.length) { terminarCarta(); return; }
      }
    }
  }

  /**
   * Auto-scroll "educado": solo sigue al texto si quien lee ya está
   * cerca del final. Si subió a releer un párrafo, no lo empujamos.
   */
  function seguirEscritura() {
    const resto = card.scrollHeight - card.scrollTop - card.clientHeight;
    if (resto < 90) card.scrollTop = card.scrollHeight;
  }

  /** Muestra la carta entera de una (al tocar la tarjeta). */
  function completarCarta() {
    if (maquina.terminada) return;
    letter.innerHTML = '';
    CARTA.forEach(function (texto) {
      const p = document.createElement('p');
      p.textContent = texto;
      letter.appendChild(p);
    });
    terminarCarta();
  }

  function terminarCarta() {
    maquina.terminada = true;
    maquina.activa = false;
    if (maquina.cursor && maquina.cursor.parentNode) maquina.cursor.parentNode.removeChild(maquina.cursor);
    hint.classList.remove('is-visible');
    sign.classList.add('is-visible');
    card.scrollTop = card.scrollHeight;
  }

  function iniciarCarta() {
    if (maquina.terminada) return;   // si ya la mostró completa de un toque, no reescribimos
    maquina.cursor = document.createElement('span');
    maquina.cursor.className = 'cursor';
    maquina.activa = true;
    maquina.proximo = 0;
    hint.classList.add('is-visible');
  }

  card.addEventListener('click', completarCarta);

  /* =============================================================
     10. CLAVE DE 4 DÍGITOS
     La carta recién aparece cuando se ingresa CONFIG.clave. Las
     flores y la música, en cambio, arrancan antes: mientras escribe
     el código ya tiene algo lindo para mirar y escuchar.
     ============================================================= */
  const cerradura = { buffer: '', fallos: 0, abierta: false, visible: false };

  /** Dibuja un puntito por cada dígito que tenga la clave. */
  function prepararCerradura() {
    lockDots.innerHTML = '';
    for (let i = 0; i < CONFIG.clave.length; i++) {
      lockDots.appendChild(document.createElement('span'));
    }
    pintarPuntos();
  }

  /** Pinta los puntitos según cuántos dígitos lleva escritos. */
  function pintarPuntos() {
    const puntos = lockDots.children;
    for (let i = 0; i < puntos.length; i++) {
      if (i < cerradura.buffer.length) puntos[i].classList.add('is-on');
      else puntos[i].classList.remove('is-on');
    }
  }

  function mostrarCerradura() {
    cerradura.visible = true;
    lock.classList.add('is-visible');
    lock.setAttribute('aria-hidden', 'false');
  }

  /** Vibración cortita en celulares que la soporten (en iPhone se ignora). */
  function vibrar(patron) {
    if (navigator.vibrate) { try { navigator.vibrate(patron); } catch (e) { /* nada */ } }
  }

  /** Recibe una tecla: un dígito o 'del' (borrar). */
  function pulsar(tecla) {
    if (!cerradura.visible || cerradura.abierta) return;
    lockPanel.classList.remove('is-wrong');   // corta el sacudón anterior

    if (tecla === 'del') {
      cerradura.buffer = cerradura.buffer.slice(0, -1);
      lockMsg.innerHTML = '&nbsp;';
    } else if (/^[0-9]$/.test(tecla) && cerradura.buffer.length < CONFIG.clave.length) {
      cerradura.buffer += tecla;
      vibrar(12);
    }
    pintarPuntos();

    // Al completar la cantidad de dígitos se verifica sola
    if (cerradura.buffer.length === CONFIG.clave.length) setTimeout(verificarClave, 230);
  }

  function verificarClave() {
    if (cerradura.buffer === CONFIG.clave) acertarClave();
    else errarClave();
  }

  function acertarClave() {
    cerradura.abierta = true;
    lockDots.classList.add('is-ok');
    lockMsg.textContent = '💛';
    vibrar([14, 60, 14]);
    setTimeout(function () {
      lock.classList.remove('is-visible');
      lock.setAttribute('aria-hidden', 'true');
      cerradura.visible = false;
      abrirCarta();
    }, 650);
  }

  function errarClave() {
    cerradura.fallos++;
    cerradura.buffer = '';
    lockPanel.classList.add('is-wrong');
    vibrar([30, 50, 30]);
    lockMsg.textContent = (cerradura.fallos >= 3 && CONFIG.pista)
      ? CONFIG.pista
      : 'Esa no es… probá de nuevo 💛';
    // Los puntitos se vacían recién después del sacudón
    setTimeout(pintarPuntos, 200);
  }

  // Un solo listener para todo el teclado (delegación de eventos)
  keypad.addEventListener('click', function (ev) {
    const boton = ev.target.closest('button[data-key]');
    if (boton) pulsar(boton.dataset.key);
  });

  // Teclado físico, para cuando la abren en la computadora
  window.addEventListener('keydown', function (ev) {
    if (!cerradura.visible || cerradura.abierta) return;
    if (/^[0-9]$/.test(ev.key)) pulsar(ev.key);
    else if (ev.key === 'Backspace' || ev.key === 'Delete') pulsar('del');
  });

  /** Se llama al acertar la clave: entra la carta y arranca a escribirse. */
  function abrirCarta() {
    card.classList.add('is-visible');
    setTimeout(iniciarCarta, 900);
  }

  /* =============================================================
     11. MÚSICA Y APERTURA DEL REGALO
     ============================================================= */
  function avisar(mensaje, ms) {
    toastEl.textContent = mensaje;
    toastEl.classList.add('is-visible');
    setTimeout(() => toastEl.classList.remove('is-visible'), ms || 5000);
  }

  function estadoBoton(reproduciendo) {
    btnAudio.dataset.state = reproduciendo ? 'playing' : 'paused';
    btnAudio.setAttribute('aria-label', reproduciendo ? 'Pausar música' : 'Reproducir música');
  }
  // El botón refleja SIEMPRE el estado real del <audio>, lo haya iniciado
  // el autoplay, el primer toque en la pantalla o el propio botón.
  audio.addEventListener('play', () => estadoBoton(true));
  audio.addEventListener('pause', () => estadoBoton(false));
  estadoBoton(false);

  /** Lleva el volumen hasta "destino" de a poquito (entrada elegante). */
  let fundidoActivo = 0;
  function fundirVolumen(destino, ms) {
    const id = ++fundidoActivo;               // cancela cualquier fundido anterior
    const inicio = audio.volume;
    const t0 = performance.now();
    (function paso(t) {
      if (id !== fundidoActivo) return;
      // OJO: el reloj de requestAnimationFrame puede venir unos ms ANTES
      // que t0, así que hay que acotar k (si no, el volumen da negativo
      // y el navegador tira IndexSizeError y la música queda muda).
      const k = Math.max(0, Math.min(1, (t - t0) / ms));
      const v = inicio + (destino - inicio) * k;
      audio.volume = Math.max(0, Math.min(1, v));
      if (k < 1) requestAnimationFrame(paso);
    })(t0);
  }

  /**
   * Intenta reproducir la música.
   *   opciones.fundido → entra subiendo el volumen de 0 a 1
   *   opciones.aviso   → si el navegador la bloquea, muestra un cartelito
   * Si play() es rechazado, dejamos "armado" el arranque con el primer
   * gesto del usuario (ver armarPrimerGesto).
   */
  function reproducir(opciones) {
    const o = opciones || {};
    if (!audio.paused) return;                // ya está sonando: no la reiniciamos
    // (en iPhone el volumen es de solo lectura: ahí simplemente no hay fundido)
    if (o.fundido) audio.volume = 0;
    const promesa = audio.play();
    if (promesa && promesa.then) {
      promesa.then(function () {
        if (o.fundido) fundirVolumen(1, 2500);
      }).catch(function () {
        audio.volume = 1;
        armarPrimerGesto();
        if (o.aviso && estado.audioOk) avisar('Tocá la pantalla y la música arranca sola 🎵');
      });
    }
  }

  /**
   * Plan B del autoplay. Los navegadores (sobre todo en celulares) no
   * dejan sonar audio hasta que la persona interactúa con la página, así
   * que escuchamos el PRIMER toque/click/tecla en cualquier lado y ahí
   * arrancamos la música. En la práctica: suena al tocar "Abrir regalo".
   */
  let gestoArmado = false;
  function armarPrimerGesto() {
    if (gestoArmado) return;
    gestoArmado = true;
    // Varios eventos para cubrir todos los navegadores (iOS Safari es el
    // más quisquilloso: le sirven touchend y click).
    const eventos = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];

    function arrancar(ev) {
      // Si el toque fue en el botón de música, que lo maneje él solo
      // (si no, lo prenderíamos y el botón lo apagaría enseguida).
      if (ev && ev.target && ev.target.closest && ev.target.closest('#btn-audio')) return;
      eventos.forEach((e) => window.removeEventListener(e, arrancar, true));
      gestoArmado = false;
      reproducir({ fundido: true });
    }
    // capture:true → nos enteramos del gesto antes que cualquier otro handler
    eventos.forEach((e) => window.addEventListener(e, arrancar, true));
  }

  // Si falta el archivo musica.mp3, avisamos con cariño (la página sigue andando)
  audio.addEventListener('error', function () {
    estado.audioOk = false;
    estadoBoton(false);
    avisar('Falta el archivo «musica.mp3» en la carpeta 🎵 (todo lo demás funciona igual)', 6000);
  });

  btnAudio.addEventListener('click', function () {
    if (audio.paused) {
      audio.volume = 1;
      const p = audio.play();
      if (p && p.catch) p.catch(() => armarPrimerGesto());
    } else {
      audio.pause();
    }
  });

  // --- Autoplay: lo intentamos apenas carga la página ---
  reproducir({ fundido: true });

  /** El gran momento: se abre el regalo. */
  function abrirRegalo() {
    if (estado.abierto) return;
    estado.abierto = true;
    estado.t0 = estado.tiempo;

    welcome.classList.add('is-hidden');
    ramo.visible = true;              // arranca el florecimiento (escala 0 → 1)
    reproducir({ fundido: true, aviso: true });

    // Con las flores ya abriéndose, pedimos la clave de la carta
    setTimeout(mostrarCerradura, 1100);
  }

  btnOpen.addEventListener('click', abrirRegalo);

  /* =============================================================
     ARRANQUE
     ============================================================= */
  prepararRecursos();
  prepararCerradura();
  iniciarEscena();
  arrancarBucle();
})();
