/* ==========================================
   ЧАСТЬ 1: НАСТРОЙКИ
   ========================================== */

const translations = {
    ru: {
        singleplayer: "Одиночная игра",
        multiplayer: "Сетевая игра",
        settings: "Настройки",
        language: "Язык",
        quit: "Выйти",
        select_world: "Выбор мира",
        play_world: "Играть",
        cancel: "Отмена",
        done: "Готово",
        fov_prefix: "Поле зрения: ",
        render_prefix: "Прорисовка: ",
        music_prefix: "Музыка: "
    },
    en: {
        singleplayer: "Singleplayer",
        multiplayer: "Multiplayer",
        settings: "Settings",
        language: "Language",
        quit: "Quit Game",
        select_world: "Select World",
        play_world: "Play Selected World",
        cancel: "Cancel",
        done: "Done",
        fov_prefix: "FOV: ",
        render_prefix: "Render Dist: ",
        music_prefix: "Music: "
    }
};

let currentLang = 'ru';
let gameSettings = { fov: 75, renderDist: 8, music: false };

const splashes = ["Mobile Support!", "Touch Controls!", "JavaScript!", "3D Web!"];
document.getElementById('splash-text').innerText = splashes[Math.floor(Math.random() * splashes.length)];

/* ==========================================
   ЧАСТЬ 2: МЕНЮ (ИСПРАВЛЕНО)
   ========================================== */

function showScreen(screenId) {
    // ВАЖНО: При показе любого экрана меню, включаем контейнер меню
    document.getElementById('menu-container').style.display = 'flex';
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none'; // Скрываем кнопки в меню
    
    // Переключаем активный экран внутри меню
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + '-screen').classList.add('active');
    
    isGameRunning = false;
    
    // Если вышли в меню, освобождаем курсор
    if(document.pointerLockElement) {
        document.exitPointerLock();
    }
}

// Специальная функция для кнопки меню в игре
function openMenuFromGame() {
    showScreen('main-menu');
}

function setLanguage(lang) {
    currentLang = lang;
    updateTexts();
}

function updateTexts() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[currentLang][key]) {
            el.innerText = translations[currentLang][key];
        }
    });
    updateSettingsButtons();
}

function toggleSetting(key) {
    if (key === 'fov') gameSettings.fov = gameSettings.fov === 75 ? 90 : (gameSettings.fov === 90 ? 110 : 75);
    else if (key === 'render') gameSettings.renderDist = gameSettings.renderDist === 8 ? 16 : (gameSettings.renderDist === 16 ? 4 : 8);
    else if (key === 'music') gameSettings.music = !gameSettings.music;
    
    updateSettingsButtons();
    if(camera) {
        camera.fov = gameSettings.fov;
        camera.updateProjectionMatrix();
        if (scene && scene.fog) scene.fog.far = gameSettings.renderDist * 16;
    }
}

function updateSettingsButtons() {
    const t = translations[currentLang];
    document.getElementById('btn-fov').innerText = t.fov_prefix + gameSettings.fov;
    document.getElementById('btn-render').innerText = t.render_prefix + gameSettings.renderDist;
    document.getElementById('btn-music').innerText = t.music_prefix + (gameSettings.music ? "ON" : "OFF");
}

function exitGame() { if(confirm("Закрыть окно?")) window.close(); }

/* ==========================================
   ЧАСТЬ 3: ИГРА И УПРАВЛЕНИЕ
   ========================================== */

let scene, camera, renderer;
let isGameInitialized = false;
let isGameRunning = false;
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

function startGame() {
    // Скрываем меню
    document.getElementById('menu-container').style.display = 'none';
    // Показываем интерфейс игры и кнопки
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('mobile-controls').style.display = 'block';

    if (!isGameInitialized) {
        initGame();
        initMobileControls();
        isGameInitialized = true;
    }
    
    isGameRunning = true;
    
    // Пытаемся захватить мышь (на ПК)
    // На телефоне это не сработает, но не помешает
    try {
        document.body.requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
        document.body.requestPointerLock();
    } catch(e) {}
}

function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, gameSettings.renderDist * 16);

    camera = new THREE.PerspectiveCamera(gameSettings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(16, 15, 16);
    camera.rotation.order = 'YXZ'; 

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    generateChunk();

    // Слушатели ПК
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    
    // Слушатели Мобильные (Свайпы камеры)
    document.addEventListener('touchstart', onTouchStart, {passive: false});
    document.addEventListener('touchmove', onTouchMove, {passive: false});
    document.addEventListener('touchend', onTouchEnd);

    window.addEventListener('resize', onWindowResize);
    animate();
}

// Инициализация кнопок управления
function initMobileControls() {
    const bindBtn = (id, keyState) => {
        const btn = document.getElementById(id);
        // Mouse events (для теста на пк)
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); moveState[keyState] = true; });
        btn.addEventListener('mouseup', (e) => { e.preventDefault(); moveState[keyState] = false; });
        btn.addEventListener('mouseleave', (e) => { e.preventDefault(); moveState[keyState] = false; });
        
        // Touch events
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[keyState] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); moveState[keyState] = false; });
    };

    bindBtn('btn-fwd', 'forward');
    bindBtn('btn-back', 'backward');
    bindBtn('btn-left', 'left');
    bindBtn('btn-right', 'right');
    bindBtn('btn-up', 'up');
    bindBtn('btn-down', 'down');
}

function generateChunk() {
    const matGrass = new THREE.MeshLambertMaterial({ color: 0x567d46 });
    const matDirt = new THREE.MeshLambertMaterial({ color: 0x795548 });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const simplex = new SimplexNoise();
    
    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let height = Math.floor(simplex.noise2D(x/20, z/20) * 5) + 5;
            for (let y = 0; y <= height; y++) {
                // Рисуем только видимые блоки (оптимизация)
                if (y === height || x===0 || x===31 || z===0 || z===31) {
                    let mat = (y === height) ? matGrass : matDirt;
                    const cube = new THREE.Mesh(geometry, mat);
                    cube.position.set(x, y, z);
                    scene.add(cube);
                }
            }
        }
    }
}

// --- УПРАВЛЕНИЕ ПК ---
function onKeyDown(e) {
    if(e.code === 'KeyW') moveState.forward = true;
    if(e.code === 'KeyS') moveState.backward = true;
    if(e.code === 'KeyA') moveState.left = true;
    if(e.code === 'KeyD') moveState.right = true;
    if(e.code === 'Space') moveState.up = true;
    if(e.code === 'ShiftLeft') moveState.down = true;
}
function onKeyUp(e) {
    if(e.code === 'KeyW') moveState.forward = false;
    if(e.code === 'KeyS') moveState.backward = false;
    if(e.code === 'KeyA') moveState.left = false;
    if(e.code === 'KeyD') moveState.right = false;
    if(e.code === 'Space') moveState.up = false;
    if(e.code === 'ShiftLeft') moveState.down = false;
}
function onMouseMove(e) {
    if (!isGameRunning || document.pointerLockElement !== document.body) return;
    camera.rotation.y -= e.movementX * 0.002;
    camera.rotation.x -= e.movementY * 0.002;
    camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
}

// --- УПРАВЛЕНИЕ ТАЧЕМ (КАМЕРА) ---
let lastTouchX = 0;
let lastTouchY = 0;

function onTouchStart(e) {
    // Если касание не по кнопке, запоминаем координаты для вращения камеры
    if (!e.target.classList.contains('control-btn')) {
        lastTouchX = e.touches[0].pageX;
        lastTouchY = e.touches[0].pageY;
    }
}

function onTouchMove(e) {
    if (!isGameRunning) return;
    if (e.target.classList.contains('control-btn')) return; // Не вращаем камеру, если жмем кнопки
    e.preventDefault(); // Чтобы не скроллить страницу

    const touchX = e.touches[0].pageX;
    const touchY = e.touches[0].pageY;

    const deltaX = touchX - lastTouchX;
    const deltaY = touchY - lastTouchY;

    camera.rotation.y -= deltaX * 0.005;
    camera.rotation.x -= deltaY * 0.005;
    camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));

    lastTouchX = touchX;
    lastTouchY = touchY;
}

function onTouchEnd(e) {
    // Сброс, если нужно
}

function onPointerLockChange() {
    // Если на ПК нажали ESC, показываем меню
    if (document.pointerLockElement !== document.body && isGameRunning) {
        // Мы не показываем меню автоматически на мобильных, так как там нет PointerLock
        // Для ПК: showScreen('main-menu');
        // Но сейчас оставим кнопку "Menu" для телефонов
    }
}

function onWindowResize() {
    if(camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (isGameRunning) {
        const speed = 0.15;
        // Движение вперед/назад с учетом поворота камеры (только по Y)
        const angle = camera.rotation.y;
        
        if (moveState.forward) {
            camera.position.x -= Math.sin(angle) * speed;
            camera.position.z -= Math.cos(angle) * speed;
        }
        if (moveState.backward) {
            camera.position.x += Math.sin(angle) * speed;
            camera.position.z += Math.cos(angle) * speed;
        }
        if (moveState.left) {
            camera.position.x -= Math.sin(angle + Math.PI/2) * speed;
            camera.position.z -= Math.cos(angle + Math.PI/2) * speed;
        }
        if (moveState.right) {
            camera.position.x += Math.sin(angle + Math.PI/2) * speed;
            camera.position.z += Math.cos(angle + Math.PI/2) * speed;
        }
        if (moveState.up) camera.position.y += speed;
        if (moveState.down) camera.position.y -= speed;
        
        document.getElementById('debug-info').innerText = 
            `XYZ: ${Math.round(camera.position.x)}, ${Math.round(camera.position.y)}, ${Math.round(camera.position.z)}`;
    }

    if(renderer && scene) renderer.render(scene, camera);
}

updateTexts();