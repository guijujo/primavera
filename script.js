/* =============================================================
   FLORES AMARILLAS PARA NAZA 🌻
   script.js — Three.js + JavaScript puro (sin frameworks)

   Índice:
     0. Texto de la carta (EDITALO ACÁ)
     1. Ajustes generales
     2. Referencias del DOM y estado
     3. Escena, cámara, luces
     4. Geometría: pétalos, girasol, tulipán, tallos, hojas
     5. Armado del ramo (tallos cruzados + moño)
     6. Polen flotante (partículas)
     6.b Lluvia de pétalos (pantalla de inicio)
     7. Composición responsive y resize
     8. Bucle de animación (florecimiento + vaivén)
     9. Carta con efecto máquina de escribir (+ esconderla en el celu)
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
    colorGirasol: 0xffb300,       // pétalos del girasol (dorado intenso)
    colorTallo: 0x4c7a3f,
    colorMonio: 0xf6ecd6,         // cinta de satén que ata el ramo (marfil)
    puntoQuiebre: 900,            // mismo breakpoint que styles.css
  };

  // Detectamos si el dispositivo es "modesto" para bajar la calidad
  const ESMOVIL = window.matchMedia('(max-width: ' + (CONFIG.puntoQuiebre - 1) + 'px)').matches;
  const MENOS_MOVIMIENTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Composición del ramo ✏️
     x: izquierda (−) / derecha (+) · y: altura sobre el moño · z: adelante (+) / atrás (−)
     tamano: escala de la flor · retardo: segundos extra antes de abrirse
     hoja: hacia qué costado sale su hoja (−1 izquierda, 1 derecha)
     Si agregás flores más altas o más anchas, ajustá MEDIDAS (sección 7). */
  const RAMO = [
    // Girasoles: adelante y al medio, mirando a quien mira
    { tipo: 'girasol', x:  0.00, y: 2.30, z:  0.55, tamano: 1.00, retardo: 0.00, hoja: -1 },
    { tipo: 'girasol', x: -1.15, y: 1.95, z:  0.20, tamano: 0.84, retardo: 0.35 },
    { tipo: 'girasol', x:  1.20, y: 2.05, z:  0.15, tamano: 0.86, retardo: 0.55 },
    // Tulipanes amarillos: más altos, atrás y a los costados
    { tipo: 'tulipan', x: -0.55, y: 3.20, z: -0.30, tamano: 1.00, retardo: 0.20, color: 0xffd21f },
    { tipo: 'tulipan', x:  0.60, y: 3.30, z: -0.35, tamano: 1.00, retardo: 0.45, color: 0xffc81a },
    { tipo: 'tulipan', x: -1.55, y: 2.95, z: -0.30, tamano: 0.92, retardo: 0.70, color: 0xffdc3c },
    { tipo: 'tulipan', x:  1.60, y: 3.00, z: -0.25, tamano: 0.92, retardo: 0.85, color: 0xffd21f },
    { tipo: 'tulipan', x:  0.05, y: 3.60, z: -0.65, tamano: 0.95, retardo: 1.00, color: 0xffcc26 },
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
  const cardScroll = $('card-scroll');
  const btnHide  = $('btn-hide');
  const btnLetter = $('btn-letter');
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
    cartaOculta: false,   // ¿la carta está escondida? (solo celular)
    audioOk: true,
  };

  // Si Three.js no cargó (sin internet la primera vez), avisamos y salimos
  // ANTES de tocar cualquier cosa de la librería.
  if (typeof THREE === 'undefined') {
    avisar('No se pudo cargar Three.js. Conectate a internet una vez y volvé a abrir la página 🌐', 12000);
    welcome.addEventListener('click', () => welcome.classList.add('is-hidden'));
    return;
  }

  let renderer, escena, camara, ramo, polen;
  const objetivo = new THREE.Vector3();        // hacia dónde mira la cámara
  const camaraBase = new THREE.Vector3();      // posición de reposo de la cámara
  const puntero = { x: 0, y: 0 };              // parallax suave con mouse/dedo
  const reloj = new THREE.Clock();

  /* =============================================================
     3. ESCENA, CÁMARA Y LUCES
     ============================================================= */
  let luzClave, luzCalida, monio;

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
    // Niebla muy sutil: solo apaga el polen lejano
    escena.fog = new THREE.Fog(0x0b0f0c, 12, 30);

    // La cámara mira derecho hacia adelante (ver sección 7: así el
    // encuadre del ramo se puede calcular exacto)
    camara = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);

    // ---------- LUCES ----------
    // Ambiente frío: llena las sombras sin apagar el dorado
    escena.add(new THREE.AmbientLight(0x6f86ad, 0.48));

    // Luz clave (sol tibio): genera las sombras y el relieve. Apunta
    // siempre al ramo y lo acompaña cuando se reacomoda en pantalla.
    luzClave = new THREE.DirectionalLight(0xffeec4, 1.55);
    luzClave.castShadow = true;
    const mapa = ESMOVIL ? 1024 : 2048;
    luzClave.shadow.mapSize.set(mapa, mapa);
    const cs = luzClave.shadow.camera;
    cs.near = 1;
    cs.far = 30;
    cs.left = -4.5;
    cs.right = 4.5;
    cs.top = 5.5;
    cs.bottom = -4.5;
    luzClave.shadow.bias = -0.0009;
    escena.add(luzClave);

    // Luz de relleno azulada desde atrás: recorta la silueta de los pétalos
    const relleno = new THREE.DirectionalLight(0x9cc6ff, 0.40);
    relleno.position.set(-5, 2.5, -4);
    escena.add(relleno);

    // Punto cálido delante del ramo: el brillo dorado de los pétalos
    luzCalida = new THREE.PointLight(0xffa93a, 1.15, 18, 1);
    escena.add(luzCalida);

    // ---------- EL RAMO ----------
    // Su origen (0,0,0) es el MOÑO: todos los tallos se cruzan ahí.
    ramo = new THREE.Group();
    ramo.visible = false;               // aparece recién al abrir el regalo
    escena.add(ramo);
    luzClave.target = ramo;             // la sombra siempre cubre el ramo

    monio = crearMonio();
    monio.scale.setScalar(0.0001);      // arranca invisible: aparece primero
    ramo.add(monio);

    RAMO.forEach(function (def) { ramo.add(crearFlor(def)); });

    // ---------- POLEN ----------
    polen = crearPolen(ESMOVIL ? 160 : 320);
    escena.add(polen);

    // ---------- LLUVIA DE PÉTALOS (mientras espera abrir el regalo) ----------
    if (!MENOS_MOVIMIENTO) {
      lluvia = crearLluvia();
      escena.add(lluvia);
    }

    actualizarComposicion(true);
  }

  /* =============================================================
     4. GEOMETRÍA DE LAS FLORES
     Todo se genera con matemática: curvas de Bézier para el contorno
     de cada pétalo, extrusión para darle volumen, y una deformación
     de los vértices para curvarlo y ahuecarlo. Con la MISMA función,
     cambiando parámetros, salen pétalos de girasol, de tulipán y hojas.
     ============================================================= */
  const ARRIBA = new THREE.Vector3(0, 1, 0);
  const azar = (a) => (Math.random() - 0.5) * 2 * a;   // número al azar en [-a, a]

  /**
   * Crea la geometría de UN pétalo (u hoja).
   * 1) Contorno con curvas de Bézier: nace angosto en la base (0,0) y
   *    termina en (0, largo), en punta ('aguda') o redondeado ('redonda').
   * 2) ExtrudeGeometry le da espesor + bisel (bordes que atrapan la luz).
   * 3) Recorremos los vértices para:
   *      curva   → la punta se inclina hacia afuera (+) o hacia adentro (−)
   *      canal   → los bordes se levantan: sección en "U" (copa del tulipán)
   *      torsion → leve giro sobre su eje (nada en la naturaleza es plano)
   *    y pintamos un degradado por vértice: base más oscura → punta clara.
   */
  function crearGeometriaPetalo(opciones) {
    const o = Object.assign({
      largo: 1, ancho: 0.3, curva: 0.3, canal: 0.5, torsion: 0.15,
      punta: 'redonda', grosor: 0.04, segmentos: 14,
      base: [0.86, 0.66, 0.50],       // multiplicador de color en la base
    }, opciones);

    const contorno = new THREE.Shape();
    contorno.moveTo(0, 0);
    if (o.punta === 'aguda') {
      // Lanceolado: los dos lados se juntan en punta (girasol, hojas)
      contorno.bezierCurveTo(o.ancho * 0.9, o.largo * 0.18, o.ancho * 0.8, o.largo * 0.68, 0, o.largo);
      contorno.bezierCurveTo(-o.ancho * 0.8, o.largo * 0.68, -o.ancho * 0.9, o.largo * 0.18, 0, 0);
    } else {
      // Redondeado: lados que se ensanchan y una punta suave (tulipán)
      contorno.bezierCurveTo(o.ancho * 0.85, o.largo * 0.12, o.ancho, o.largo * 0.55, o.ancho * 0.30, o.largo * 0.93);
      contorno.quadraticCurveTo(0, o.largo * 1.05, -o.ancho * 0.30, o.largo * 0.93);
      contorno.bezierCurveTo(-o.ancho, o.largo * 0.55, -o.ancho * 0.85, o.largo * 0.12, 0, 0);
    }

    const geo = new THREE.ExtrudeGeometry(contorno, {
      depth: o.grosor,
      bevelEnabled: true,
      bevelThickness: o.grosor * 0.5,
      bevelSize: Math.min(0.028, o.ancho * 0.12),
      bevelSegments: 2,
      curveSegments: o.segmentos,
    });

    const pos = geo.attributes.position;
    const colores = new Float32Array(pos.count * 3);
    const PUNTA = 1.06;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      let z = pos.getZ(i);

      const t = Math.max(0, Math.min(1, y / o.largo));   // 0 en la base, 1 en la punta

      z += o.curva * t * t;                 // la punta se va hacia afuera / adentro
      z -= o.canal * x * x;                 // los bordes se levantan: sección en "U"

      const a = o.torsion * t;              // torsión alrededor del eje del pétalo
      const cos = Math.cos(a), sen = Math.sin(a);
      pos.setXYZ(i, x * cos + z * sen, y, -x * sen + z * cos);

      // Degradado (estos valores MULTIPLICAN al color del material)
      colores[i * 3 + 0] = o.base[0] + (PUNTA - o.base[0]) * t;
      colores[i * 3 + 1] = o.base[1] + (PUNTA - o.base[1]) * t;
      colores[i * 3 + 2] = o.base[2] + (PUNTA - o.base[2]) * t;
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    geo.computeVertexNormals();             // recalculamos normales o la luz se ve mal
    return geo;
  }

  /* -------------------------------------------------------------
     CORONA DE PÉTALOS INSTANCIADA
     Todos los pétalos de un anillo son UNA sola malla (InstancedMesh):
     la GPU los dibuja de una vez (1 draw call en vez de 20). Clave para
     que el ramo ande fluido en el celular.
     Cada pétalo i:
       · gira alrededor del eje de la flor: ángulo θi = 360° · i / n
       · se aleja `radio` del centro
       · se inclina sobre su base: rx (0 = parado, π/2 = acostado)
     El florecimiento interpola rx desde "cerrado" hasta "abierto".
     ------------------------------------------------------------- */
  const _maniqui = new THREE.Object3D();    // objeto auxiliar para armar matrices
  _maniqui.rotation.order = 'YXZ';          // primero el giro θ, después la inclinación
  const _tinte = new THREE.Color();

  function crearCorona(o) {
    const malla = new THREE.InstancedMesh(o.geometria, o.material, o.cantidad);
    malla.castShadow = !ESMOVIL;            // en el celu ahorramos esta pasada de sombra
    malla.receiveShadow = true;
    malla.frustumCulled = false;            // las instancias se salen de la caja base

    const paso = (Math.PI * 2) / o.cantidad;
    const datos = [];
    for (let i = 0; i < o.cantidad; i++) {
      datos.push({
        angulo: (o.desfase || 0) + i * paso + azar(paso * (o.desorden || 0.08)),
        rxAbierto: o.rxAbierto + azar(o.variacion || 0.06),
        rxCerrado: o.rxCerrado,
        escala: (o.escala || 1) * (0.9 + Math.random() * 0.2),
        abanico: azar(0.08),                // leve abanico dentro de su plano
      });
      // Variación de tono pétalo a pétalo
      if (malla.setColorAt) {
        const v = 0.9 + Math.random() * 0.14;
        _tinte.setRGB(v, v * (0.97 + Math.random() * 0.05), v);
        malla.setColorAt(i, _tinte);
      }
    }
    malla.userData = { datos: datos, radio: o.radio };
    posarCorona(malla, o.abierta ? 1 : 0);
    return malla;
  }

  /** Ubica cada pétalo según cuánto se abrió la flor (0 = capullo, 1 = abierta). */
  function posarCorona(malla, abrir) {
    const d = malla.userData;
    const crecer = 0.3 + 0.7 * abrir;       // el pétalo también crece al abrirse
    for (let i = 0; i < d.datos.length; i++) {
      const p = d.datos[i];
      _maniqui.position.set(Math.sin(p.angulo) * d.radio, 0, Math.cos(p.angulo) * d.radio);
      _maniqui.rotation.set(p.rxCerrado + (p.rxAbierto - p.rxCerrado) * abrir, p.angulo, p.abanico);
      _maniqui.scale.setScalar(p.escala * crecer);
      _maniqui.updateMatrix();
      malla.setMatrixAt(i, _maniqui.matrix);
    }
    malla.instanceMatrix.needsUpdate = true;
  }

  /* -------------------------------------------------------------
     GIRASOL
     Disco oscuro con semillas en la espiral de Fibonacci: la semilla i
     va al ángulo i · 137,5° (el ÁNGULO ÁUREO) y a un radio ∝ √i.
     Es exactamente el patrón de los girasoles reales. Alrededor, 21 + 13
     pétalos (también números de Fibonacci) y un collar de brácteas verdes.
     ------------------------------------------------------------- */
  const RADIO_DISCO = 0.5;

  function crearDiscoGirasol() {
    const R = RADIO_DISCO;
    const grupo = new THREE.Group();

    // Cúpula apenas abombada
    const disco = new THREE.Mesh(GEO.cupula, MAT.disco);
    disco.scale.set(R, R * 0.28, R);
    disco.receiveShadow = true;
    grupo.add(disco);

    // Semillas: todas en una sola malla instanciada
    const cantidad = ESMOVIL ? 130 : 230;
    const ANGULO_AUREO = Math.PI * (3 - Math.sqrt(5));   // ≈ 137,5°
    const semillas = new THREE.InstancedMesh(GEO.semilla, MAT.semilla, cantidad);
    semillas.frustumCulled = false;
    semillas.receiveShadow = true;

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const verde = new THREE.Color(0x5b5a1c);    // centro verdoso
    const marron = new THREE.Color(0x2e1a0c);   // cuerpo marrón oscuro
    const ocre = new THREE.Color(0x8a5a14);     // flores del borde, con polen

    for (let i = 0; i < cantidad; i++) {
      const f = i / cantidad;                        // 0 en el centro, 1 en el borde
      const r = R * 0.95 * Math.sqrt(f);             // √ reparte áreas iguales
      const a = i * ANGULO_AUREO;
      const altura = R * 0.28 * Math.sqrt(Math.max(0, 1 - 0.9025 * f));   // sobre la cúpula
      p.set(Math.cos(a) * r, altura, Math.sin(a) * r);
      e.set(azar(0.3), a, azar(0.3));
      q.setFromEuler(e);
      const k = 0.75 + 0.55 * f + Math.random() * 0.15;   // más grandes hacia el borde
      s.set(k, k * 0.6, k);
      semillas.setMatrixAt(i, m.compose(p, q, s));

      if (semillas.setColorAt) {
        _tinte.copy(verde).lerp(marron, Math.min(1, f * 1.8));
        if (f > 0.8) _tinte.lerp(ocre, (f - 0.8) / 0.2);
        semillas.setColorAt(i, _tinte);
      }
    }
    semillas.instanceMatrix.needsUpdate = true;
    grupo.add(semillas);
    return grupo;
  }

  function crearGirasol() {
    const R = RADIO_DISCO;
    const cabeza = new THREE.Group();
    const coronas = [];

    cabeza.add(crearDiscoGirasol());

    // Reverso verde (tapa la unión con el tallo)
    const reverso = new THREE.Mesh(GEO.reverso, MAT.bractea);
    reverso.scale.set(R * 0.95, R * 0.42, R * 0.95);
    reverso.castShadow = true;
    cabeza.add(reverso);

    // Collar de brácteas verdes, apuntando un poco hacia atrás (estático)
    const bracteas = crearCorona({
      geometria: GEO.bractea, material: MAT.bractea, cantidad: 16,
      radio: R * 0.75, rxAbierto: Math.PI / 2 + 0.3, rxCerrado: Math.PI / 2 + 0.3,
      desorden: 0.3, abierta: true,
    });
    bracteas.position.y = -0.04;
    cabeza.add(bracteas);

    // Dos anillos de pétalos (21 + 13), el interior desfasado medio paso
    coronas.push(crearCorona({
      geometria: GEO.petaloGirasol, material: MAT.girasol, cantidad: 21,
      radio: R * 0.9, rxAbierto: Math.PI / 2 - 0.08, rxCerrado: 0.15,
    }));
    coronas.push(crearCorona({
      geometria: GEO.petaloGirasol, material: MAT.girasol, cantidad: 13,
      radio: R * 0.82, rxAbierto: Math.PI / 2 - 0.38, rxCerrado: 0.10,
      escala: 0.9, desfase: Math.PI / 13,
    }));
    coronas.forEach(function (c) { cabeza.add(c); });

    return { cabeza: cabeza, coronas: coronas };
  }

  /* -------------------------------------------------------------
     TULIPÁN
     Seis pétalos anchos y muy ahuecados (canal alto) que se curvan
     hacia adentro (curva negativa): juntos forman la copa. Como en el
     tulipán real, van en dos anillos de 3, desfasados 60°.
     ------------------------------------------------------------- */
  function crearTulipan(def) {
    const cabeza = new THREE.Group();
    const coronas = [];
    const material = materialPetalo(def.color, 0xff9d00);

    const base = new THREE.Mesh(GEO.bolita, MAT.tallo);
    base.scale.y = 0.9;
    base.position.y = 0.03;
    cabeza.add(base);

    coronas.push(crearCorona({
      geometria: GEO.petaloTulipan, material: material, cantidad: 3,
      radio: 0.06, rxAbierto: 0.34, rxCerrado: 0.03, desorden: 0.06,
    }));
    coronas.push(crearCorona({
      geometria: GEO.petaloTulipan, material: material, cantidad: 3,
      radio: 0.035, rxAbierto: 0.20, rxCerrado: -0.02, escala: 0.95,
      desfase: Math.PI / 3, desorden: 0.06,
    }));
    coronas.forEach(function (c) { cabeza.add(c); });

    return { cabeza: cabeza, coronas: coronas };
  }

  /* -------------------------------------------------------------
     TALLO: una curva Catmull-Rom convertida en tubo.
     ------------------------------------------------------------- */
  function crearTallo(curva, grosor) {
    const geo = new THREE.TubeGeometry(curva, ESMOVIL ? 24 : 40, grosor, ESMOVIL ? 6 : 8, false);
    const malla = new THREE.Mesh(geo, MAT.tallo);
    malla.castShadow = true;
    malla.receiveShadow = true;
    return malla;
  }

  // --- Geometrías y materiales compartidos (se crean UNA vez) ---
  const GEO = {};
  const MAT = {};
  const MAT_PETALOS = {};

  function prepararRecursos() {
    const seg = ESMOVIL ? 10 : 16;

    GEO.petaloGirasol = crearGeometriaPetalo({
      largo: 0.62, ancho: 0.17, curva: 0.14, canal: 1.1, torsion: 0.22,
      punta: 'aguda', grosor: 0.03, segmentos: seg, base: [0.9, 0.6, 0.4],
    });
    GEO.bractea = crearGeometriaPetalo({
      largo: 0.36, ancho: 0.13, curva: 0.08, canal: 0.6, torsion: 0.1,
      punta: 'aguda', grosor: 0.025, segmentos: 8, base: [0.7, 0.75, 0.7],
    });
    GEO.petaloTulipan = crearGeometriaPetalo({
      largo: 0.9, ancho: 0.34, curva: -0.14, canal: 1.7, torsion: 0.06,
      punta: 'redonda', grosor: 0.03, segmentos: seg, base: [0.92, 0.72, 0.5],
    });
    GEO.hojaGirasol = crearGeometriaPetalo({
      largo: 1.0, ancho: 0.42, curva: 0.3, canal: 0.3, torsion: 0.35,
      punta: 'aguda', grosor: 0.025, segmentos: 12, base: [0.75, 0.8, 0.72],
    });
    GEO.hojaTulipan = crearGeometriaPetalo({
      largo: 1.5, ancho: 0.18, curva: 0.55, canal: 0.6, torsion: 0.7,
      punta: 'aguda', grosor: 0.02, segmentos: 12, base: [0.78, 0.84, 0.78],
    });

    // Versiones centradas para la lluvia: giran sobre su centro, no sobre la base
    GEO.lluviaGirasol = GEO.petaloGirasol.clone().translate(0, -0.31, 0);
    GEO.lluviaTulipan = GEO.petaloTulipan.clone().translate(0, -0.45, 0);

    GEO.semilla = new THREE.IcosahedronGeometry(0.032, 0);
    GEO.cupula = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);            // media esfera de arriba
    GEO.reverso = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); // media esfera de abajo
    GEO.bolita = new THREE.SphereGeometry(0.085, 12, 8);
    GEO.colaMonio = new THREE.BoxGeometry(0.085, 0.46, 0.012);
    GEO.colaMonio.translate(0, -0.23, 0);   // que cuelgue desde arriba

    MAT.tallo   = new THREE.MeshStandardMaterial({ color: CONFIG.colorTallo, roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide });
    MAT.hoja    = new THREE.MeshStandardMaterial({ color: 0x5f9145, roughness: 0.62, metalness: 0.08, side: THREE.DoubleSide, vertexColors: true });
    MAT.bractea = new THREE.MeshStandardMaterial({ color: 0x4f7f3a, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide, vertexColors: true });
    MAT.disco   = new THREE.MeshStandardMaterial({ color: 0x3b2412, roughness: 0.92, metalness: 0.02 });
    MAT.semilla = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.1, flatShading: true });
    MAT.monio   = new THREE.MeshStandardMaterial({ color: CONFIG.colorMonio, roughness: 0.3, metalness: 0.12, side: THREE.DoubleSide });
    MAT.girasol = materialPetalo(CONFIG.colorGirasol, 0xff7a00);
  }

  /** Material satinado de pétalo (se reutiliza si el color se repite). */
  function materialPetalo(color, emisivo) {
    const clave = color + '_' + emisivo;
    if (!MAT_PETALOS[clave]) {
      MAT_PETALOS[clave] = new THREE.MeshStandardMaterial({
        color: color,
        vertexColors: true,       // usa el degradado base → punta
        roughness: 0.34,          // bajo = brillo satinado
        metalness: 0.18,          // toque metálico → acabado dorado
        emissive: emisivo,        // autoiluminación tenue: "brilla" en la noche
        emissiveIntensity: 0.1,
        side: THREE.DoubleSide,   // los pétalos son finos: se ven de los dos lados
      });
    }
    return MAT_PETALOS[clave];
  }

  /* =============================================================
     5. ARMADO DEL RAMO
     Ramo atado a mano: todos los tallos se CRUZAN en el moño (el origen
     del grupo), se abren hacia arriba en las flores y un poquito hacia
     abajo en los cortes. Cada flor crece desde el moño al florecer.
     ============================================================= */
  function crearFlor(def) {
    const flor = new THREE.Group();
    const esGirasol = def.tipo === 'girasol';
    const cabezaPos = new THREE.Vector3(def.x, def.y, def.z);

    // 1) Curva del tallo: corte (bajo el moño) → moño → mitad → flor
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-def.x * 0.15, -0.95, -def.z * 0.15 + 0.02),
      new THREE.Vector3(def.x * 0.03, 0, def.z * 0.03),
      new THREE.Vector3(def.x * 0.5 + azar(0.08), def.y * 0.55, def.z * 0.5 + azar(0.08)),
      cabezaPos.clone(),
    ]);
    flor.add(crearTallo(curva, esGirasol ? 0.055 : 0.036));

    // 2) Una hoja que sale del tallo hacia un costado
    const lado = def.hoja || (def.x >= 0 ? 1 : -1);
    const punto = curva.getPointAt(esGirasol ? 0.52 : 0.42);
    const dirHoja = new THREE.Vector3(lado * 0.85, esGirasol ? 0.45 : 0.8, 0.3 + def.z * 0.3).normalize();
    const hoja = new THREE.Mesh(esGirasol ? GEO.hojaGirasol : GEO.hojaTulipan, MAT.hoja);
    hoja.position.copy(punto);
    hoja.quaternion.setFromUnitVectors(ARRIBA, dirHoja);
    hoja.rotateY(azar(0.5));               // gira un poco la lámina
    hoja.scale.setScalar(def.tamano);
    hoja.castShadow = true;
    hoja.receiveShadow = true;
    flor.add(hoja);

    // 3) La cabeza sigue la dirección final del tallo, un poco girada
    //    hacia quien mira (los girasoles más: "buscan el sol")
    const pivote = new THREE.Group();
    pivote.position.copy(cabezaPos);
    const dir = curva.getTangentAt(1);
    dir.z += esGirasol ? 0.85 : 0.2;
    pivote.quaternion.setFromUnitVectors(ARRIBA, dir.normalize());

    const armado = esGirasol ? crearGirasol() : crearTulipan(def);
    armado.cabeza.scale.setScalar(def.tamano);
    pivote.add(armado.cabeza);
    flor.add(pivote);

    // Datos que usa el bucle de animación
    flor.userData = {
      cabeza: armado.cabeza,
      coronas: armado.coronas,
      retardo: def.retardo,
      fase: Math.random() * Math.PI * 2,   // desfase del cabeceo
      abrirPrevio: -1,
    };

    flor.scale.setScalar(0.0001);          // arranca escondida en el moño
    return flor;
  }

  /**
   * MOÑO DE SATÉN: una banda (cilindro abierto) que abraza los tallos,
   * dos lazos (toros aplastados), el nudo y dos colas que cuelgan.
   */
  function crearMonio() {
    const g = new THREE.Group();
    const mat = MAT.monio;

    const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.2, 36, 1, true), mat);
    g.add(banda);

    const lazoGeo = new THREE.TorusGeometry(0.17, 0.045, 12, 40);
    [-1, 1].forEach(function (lado) {
      const lazo = new THREE.Mesh(lazoGeo, mat);
      lazo.scale.set(1.25, 0.62, 0.55);
      lazo.position.set(lado * 0.2, 0.03, 0.24);
      lazo.rotation.set(0, lado * 0.35, lado * 0.32);
      g.add(lazo);

      const cola = new THREE.Mesh(GEO.colaMonio, mat);
      cola.position.set(lado * 0.07, -0.04, 0.24);
      cola.rotation.set(0.15, 0, lado * 0.32);
      g.add(cola);
    });

    const nudo = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mat);
    nudo.scale.set(1, 1.15, 0.8);
    nudo.position.set(0, 0.02, 0.23);
    g.add(nudo);

    g.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    return g;
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
      posiciones[i * 3 + 1] = Math.random() * 11 - 5.5;
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
      if (attr.array[j + 1] > 5.5) attr.array[j + 1] = -5.5;                       // vuelve abajo
    }
    attr.needsUpdate = true;
  }

  /* =============================================================
     6.b LLUVIA DE PÉTALOS (pantalla de inicio)
     Mientras espera para abrir el regalo caen pétalos de girasol y de
     tulipán: los MISMOS pétalos 3D del ramo, en dos InstancedMesh
     (2 draw calls para toda la lluvia). Cada pétalo:
       · baja despacio: más rápido en el centro del vaivén y más lento
         en los extremos, como caen las hojas de verdad
       · se balancea de lado a lado (seno) y se inclina hacia donde va
       · da vueltas sobre sí mismo, así el dorado brilla al girar
     Al abrir el regalo ya no nacen pétalos nuevos: los que quedan caen
     un poco más rápido y la lluvia se apaga sola.
     ============================================================= */
  let lluvia = null;

  /** Medio alto visible a la profundidad z (la cámara está en z = DISTANCIA_CAMARA). */
  function mitadAltoEn(z) {
    return Math.tan((camara.fov / 2) * Math.PI / 180) * (DISTANCIA_CAMARA - z);
  }

  /** Ubica un pétalo arriba de la pantalla (o a cualquier altura al arrancar). */
  function sembrarPetalo(p, alInicio) {
    p.z = -4 + Math.random() * 5.5;                // −4 lejos … 1,5 cerca de la cámara
    const mitadAlto = mitadAltoEn(p.z);
    const mitadAncho = mitadAlto * camara.aspect;
    p.x0 = azar(mitadAncho * 1.05);
    p.y = alInicio
      ? -mitadAlto + Math.random() * (mitadAlto * 2 + 1)   // ya repartidos: la pantalla no arranca vacía
      : mitadAlto + 0.5 + Math.random() * 1.5;             // nace justo arriba del borde
    p.vy = 0.38 + Math.random() * 0.34;            // velocidad de caída
    p.amp = 0.2 + Math.random() * 0.45;            // ancho del vaivén
    p.frec = 0.9 + Math.random() * 0.8;            // ritmo del vaivén
    p.fase = Math.random() * Math.PI * 2;
    p.deriva = azar(0.1);                          // brisa: se corre de a poco
    p.rx = Math.random() * Math.PI * 2;
    p.ry = Math.random() * Math.PI * 2;
    p.vrx = azar(1.3);                             // vueltas sobre sí mismo
    p.vry = azar(1.8);
    p.t = 0;
    p.vivo = true;
  }

  function crearLluvia() {
    const grupo = new THREE.Group();
    const total = ESMOVIL ? 26 : 44;
    // Materiales propios con más brillo: los pétalos "encienden" la noche
    // y su cara en sombra no se ve marrón al girar
    const brillo = function (m) { const c = m.clone(); c.emissiveIntensity = 0.26; return c; };
    const tipos = [
      { geo: GEO.lluviaGirasol, mat: brillo(MAT.girasol), escala: 1.0 },
      { geo: GEO.lluviaTulipan, mat: brillo(materialPetalo(0xffd21f, 0xff9d00)), escala: 0.55 },
    ];

    tipos.forEach(function (tipo) {
      const n = Math.round(total / tipos.length);
      const malla = new THREE.InstancedMesh(tipo.geo, tipo.mat, n);
      malla.frustumCulled = false;                 // las instancias andan por toda la pantalla
      const petalos = [];
      for (let i = 0; i < n; i++) {
        const p = { escala: tipo.escala * (0.5 + Math.random() * 0.45) };
        sembrarPetalo(p, true);
        petalos.push(p);
        if (malla.setColorAt) {                    // cada pétalo con su tono
          const v = 0.88 + Math.random() * 0.18;
          _tinte.setRGB(v, v * (0.95 + Math.random() * 0.08), v);
          malla.setColorAt(i, _tinte);
        }
      }
      malla.userData.petalos = petalos;
      grupo.add(malla);
    });
    return grupo;
  }

  /** Esconde un pétalo que ya no va a volver (escala 0). */
  function apagarPetalo(malla, i, p) {
    p.vivo = false;
    _maniqui.scale.setScalar(0);
    _maniqui.updateMatrix();
    malla.setMatrixAt(i, _maniqui.matrix);
  }

  function animarLluvia(dt) {
    if (!lluvia || !lluvia.visible) return;

    // Al abrir el regalo los pétalos que quedan aceleran de a poco (×1 → ×2,6)
    const prisa = estado.abierto ? 1 + Math.min(1.6, (estado.tiempo - estado.t0) * 0.8) : 1;
    let enPantalla = 0;

    lluvia.children.forEach(function (malla) {
      const petalos = malla.userData.petalos;
      for (let i = 0; i < petalos.length; i++) {
        const p = petalos[i];
        if (!p.vivo) continue;

        const mitadAlto = mitadAltoEn(p.z);
        // Con el regalo abierto, los que todavía no entraron a la pantalla no aparecen
        if (estado.abierto && p.y > mitadAlto + 0.3) { apagarPetalo(malla, i, p); continue; }

        p.t += dt;
        const onda = p.t * p.frec + p.fase;
        p.y -= p.vy * prisa * (0.65 + 0.55 * Math.abs(Math.cos(onda))) * dt;
        p.rx += p.vrx * dt;
        p.ry += p.vry * dt;

        // ¿Salió por abajo? Renace arriba… salvo que el regalo ya esté abierto
        if (p.y < -mitadAlto - 0.8) {
          if (estado.abierto) { apagarPetalo(malla, i, p); continue; }
          sembrarPetalo(p, false);
        }

        _maniqui.position.set(p.x0 + p.deriva * p.t + Math.sin(onda) * p.amp, p.y, p.z);
        // Se inclina hacia donde se balancea (la derivada del seno es el coseno)
        _maniqui.rotation.set(p.rx, p.ry, Math.cos(onda) * 0.6);
        _maniqui.scale.setScalar(p.escala);
        _maniqui.updateMatrix();
        malla.setMatrixAt(i, _maniqui.matrix);
        enPantalla++;
      }
      malla.instanceMatrix.needsUpdate = true;
    });

    // Cayó el último pétalo después de abrir el regalo: apagamos la lluvia
    if (estado.abierto && enPantalla === 0) lluvia.visible = false;
  }

  /* =============================================================
     7. COMPOSICIÓN RESPONSIVE + RESIZE
     El ramo se escala y se ubica para entrar SIEMPRE en la zona libre
     de la pantalla. Con la cámara mirando derecho, el alto de pantalla
     y el del mundo se relacionan de forma lineal:
         alto visible = 2 · tan(fov / 2) · distancia
     ============================================================= */
  // Medidas del ramo en unidades de la escena (el moño está en y = 0)
  const MEDIDAS = {
    anchoMitad: 2.2,      // medio ancho, hasta el pétalo más lateral
    abajo: -1.0,          // corte de los tallos
    arriba: 4.45,         // punta del tulipán más alto
    cabezasAbajo: 1.1,    // borde inferior de la flor más baja
  };
  const DISTANCIA_CAMARA = 10;
  const destino = { pos: new THREE.Vector3(), escala: 1 };   // hacia dónde se desliza el ramo

  function actualizarComposicion(instantaneo) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const escritorio = w >= CONFIG.puntoQuiebre;
    const cartaOculta = estado.cartaOculta && !escritorio;

    camara.aspect = w / h;
    camaraBase.set(0, 0, DISTANCIA_CAMARA);
    objetivo.set(0, 0, 0);

    const tan = Math.tan((camara.fov / 2) * Math.PI / 180);
    const altoVisible = 2 * tan * DISTANCIA_CAMARA;
    const anchoVisible = altoVisible * camara.aspect;

    // Zona de la pantalla que puede ocupar el ramo (fracciones medidas
    // desde arriba) y desde qué altura del ramo tiene que entrar ahí.
    let zona;
    if (escritorio) {
      // La carta va a la izquierda: el ramo entero en la mitad derecha
      zona = { arriba: 0.06, abajo: 0.95, desde: MEDIDAS.abajo, ancho: 0.46, centroX: 0.25 };
    } else if (cartaOculta) {
      // Carta escondida: el ramo completo es el protagonista
      zona = { arriba: 0.10, abajo: 0.86, desde: MEDIDAS.abajo, ancho: 1.02, centroX: 0 };
    } else {
      // Carta abajo: arriba solo las flores; tallos y moño quedan tras el vidrio
      zona = { arriba: 0.07, abajo: 0.40, desde: MEDIDAS.cabezasAbajo, ancho: 1.0, centroX: 0 };
    }

    const altoZona = (zona.abajo - zona.arriba) * altoVisible;
    const altoRamo = MEDIDAS.arriba - zona.desde;
    let k = Math.min(altoZona / altoRamo, (zona.ancho * anchoVisible) / (2 * MEDIDAS.anchoMitad));
    k = Math.min(k, 1.2);

    const yCentroZona = (0.5 - (zona.arriba + zona.abajo) / 2) * altoVisible;
    destino.escala = k;
    destino.pos.set(
      zona.centroX * anchoVisible,
      yCentroZona - k * (MEDIDAS.arriba + zona.desde) / 2,
      0
    );

    if (instantaneo) {
      ramo.position.copy(destino.pos);
      ramo.scale.setScalar(destino.escala);
      camara.position.copy(camaraBase);
    }
    camara.updateProjectionMatrix();      // ← imprescindible tras cambiar el aspect
  }

  function ajustarTamano() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    actualizarComposicion();              // recalcula aspect, encuadre y escala
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

  function animarRamo() {
    const t = estado.tiempo;
    const desde = estado.abierto ? t - estado.t0 : 0;

    // 1) El moño aparece primero, con un pequeño rebote
    monio.scale.setScalar(Math.max(0.0001, easeOutBack(clamp01(desde / 0.7))));

    ramo.children.forEach(function (flor) {
      const d = flor.userData;
      if (!d || !d.coronas) return;        // el moño no es una flor

      // Progreso del florecimiento de ESTA flor (0 → 1)
      const p = estado.abierto
        ? clamp01((desde - 0.25 - d.retardo) / CONFIG.duracionFlorecimiento)
        : 0;

      // 2) La flor brota desde el moño (escala 0 → 1 con rebote)
      flor.scale.setScalar(Math.max(0.0001, easeOutBack(clamp01(p / 0.7))));

      // 3) Los pétalos se abren; cuando terminan, dejamos de recalcular
      const abrir = easeOutCubic(clamp01((p - 0.3) / 0.7));
      if (abrir !== d.abrirPrevio) {
        d.coronas.forEach(function (c) { posarCorona(c, abrir); });
        d.abrirPrevio = abrir;
      }

      // 4) La cabeza se despereza girando al abrir y después cabecea con la brisa
      d.cabeza.rotation.y = (1 - abrir) * -1.2;
      if (!MENOS_MOVIMIENTO) {
        d.cabeza.rotation.x = Math.sin(t * 0.9 + d.fase) * 0.045;
        d.cabeza.rotation.z = Math.cos(t * 0.7 + d.fase) * 0.04;
      }
    });

    // 5) Rotación suave: el ramo se mece de un lado al otro, como en la mano
    if (!MENOS_MOVIMIENTO) {
      ramo.rotation.y = Math.sin(t * 0.32) * 0.45;
      ramo.rotation.z = Math.sin(t * 0.5 + 1.3) * 0.025;
    }
  }

  function bucle() {
    if (!estado.visible) { estado.corriendo = false; return; }  // oculta: no gastamos GPU
    requestAnimationFrame(bucle);

    const dt = Math.min(reloj.getDelta(), 0.05);    // cap: evita saltos tras un lag
    estado.tiempo += dt;

    animarRamo();
    animarPolen(dt);
    animarLluvia(dt);
    pasoMaquina(dt * 1000);

    // El ramo se desliza suave hacia su encuadre (al esconder la carta,
    // al girar el celular…). Suavizado independiente de los FPS.
    const suave = 1 - Math.exp(-dt * 3.5);
    ramo.position.lerp(destino.pos, suave);
    ramo.scale.setScalar(mezclar(ramo.scale.x, destino.escala, suave));

    // Las luces acompañan al ramo
    luzClave.position.set(ramo.position.x + 4.5, ramo.position.y + 7.5, 5.5);
    luzCalida.position.set(ramo.position.x + 0.6, ramo.position.y + 2.8 * ramo.scale.x, 3.8);

    // Parallax: la cámara persigue con suavidad su posición objetivo
    const fuerza = MENOS_MOVIMIENTO ? 0 : 1;
    camara.position.x += (camaraBase.x + puntero.x * 0.6 * fuerza - camara.position.x) * 0.05;
    camara.position.y += (camaraBase.y - puntero.y * 0.4 * fuerza - camara.position.y) * 0.05;
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
    // Con la carta escondida la máquina se pausa: sigue donde quedó al volver
    if (!maquina.activa || maquina.terminada || estado.cartaOculta) return;

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
    const resto = cardScroll.scrollHeight - cardScroll.scrollTop - cardScroll.clientHeight;
    if (resto < 90) cardScroll.scrollTop = cardScroll.scrollHeight;
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
    cardScroll.scrollTop = cardScroll.scrollHeight;
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
     9.b ESCONDER / MOSTRAR LA CARTA (celular)
     En el celu la carta tapa medio ramo: con la flechita se esconde
     hacia abajo y el ramo se desliza al centro. La píldora "Ver la
     carta" la trae de vuelta (la máquina de escribir sigue donde quedó).
     ============================================================= */
  function ocultarCarta(ocultar) {
    estado.cartaOculta = ocultar;
    card.classList.toggle('is-collapsed', ocultar);
    btnLetter.classList.toggle('is-visible', ocultar);
    btnHide.setAttribute('aria-expanded', String(!ocultar));
    btnLetter.setAttribute('aria-expanded', String(!ocultar));
    actualizarComposicion();          // el ramo se reacomoda con transición suave
  }

  btnHide.addEventListener('click', function (ev) {
    ev.stopPropagation();             // si no, el toque llega a la carta y la completa de golpe
    ocultarCarta(true);
  });
  btnLetter.addEventListener('click', function () { ocultarCarta(false); });

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
  // Estado inicial REAL: el autoplay del <audio> puede haber arrancado antes
  // de que cargue este script (y ese evento 'play' ya no lo escuchamos).
  estadoBoton(!audio.paused);

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
    if (!audio.paused) { estadoBoton(true); return; }   // ya suena: no la reiniciamos
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
