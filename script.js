/* ==========================================
   ЧАСТЬ 1: НАСТРОЙКИ, ЯЗЫК И ДАННЫЕ
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
let gameSettings = {
    fov: 75,
    renderDist: 8,
    music: false
};

// Сплэши
const splashes = ["JavaScript!", "3D Web!", "Blocks!", "Hello World!", "Not Java!"];
document.getElementById('splash-text').innerText = splashes[Math.floor(Math.random() * splashes.length)];

/* ==========================================
   ЧАСТЬ 2: ЛОГИКА МЕНЮ
   ========================================== */

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + '-screen').classList.add('active');
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
    if (key === 'fov') {
        gameSettings.fov = gameSettings.fov === 75 ? 90 : (gameSettings.fov === 90 ? 110 : 75);
    } else if (key === 'render') {
        gameSettings.renderDist = gameSettings.renderDist === 8 ? 16 : (gameSettings.renderDist === 16 ? 4 : 8);
    } else if (key === 'music') {
        gameSettings.music = !gameSettings.music;
    }
    updateSettingsButtons();
    
    // Если игра уже запущена, обновляем камеру
    if(camera) {
        camera.fov = gameSettings.fov;
        camera.updateProjectionMatrix();
        
        if (scene && scene.fog) {
            scene.fog.far = gameSettings.renderDist * 16;
        }
    }
}

function updateSettingsButtons() {
    const t = translations[currentLang];
    document.getElementById('btn-fov').innerText = t.fov_prefix + gameSettings.fov;
    document.getElementById('btn-render').innerText = t.render_prefix + gameSettings.renderDist;
    document.getElementById('btn-music').innerText = t.music_prefix + (gameSettings.music ? "ON" : "OFF");
}

function exitGame() {
    if(confirm("Закрыть окно?")) window.close();
}

/* ==========================================
   ЧАСТЬ 3: ИГРОВОЙ ДВИЖОК (THREE.JS)
   ========================================== */

let scene, camera, renderer;
let isGameInitialized = false;
let isGameRunning = false;

// Перемещение
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

function startGame() {
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';

    if (!isGameInitialized) {
        initGame();
        isGameInitialized = true;
    }
    
    isGameRunning = true;
    
    // Запрос на захват курсора (Pointer Lock)
    document.body.requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
    document.body.requestPointerLock();
}

function initGame() {
    // 1. Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, gameSettings.renderDist * 16);

    // 2. Камера
    camera = new THREE.PerspectiveCamera(gameSettings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(16, 15, 16);
    // Важно: порядок вращения для FPS камеры
    camera.rotation.order = 'YXZ'; 

    // 3. Рендер
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    // 4. Свет
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    // 5. Генерация мира
    generateChunk();

    // 6. Слушатели событий
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('resize', onWindowResize);

    // 7. Запуск цикла
    animate();
}

function generateChunk() {
    // Материалы
    const matGrassTop = new THREE.MeshLambertMaterial({ color: 0x567d46 }); // Зеленый верх
    const matDirt = new THREE.MeshLambertMaterial({ color: 0x795548 });     // Коричневая земля
    
    // Геометрия куба
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Инициализация шума
    const simplex = new SimplexNoise();
    
    const size = 32; // Размер чанка 32x32

    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            // Шум для высоты
            let value = simplex.noise2D(x / 20, z / 20); // /20 делает холмы более плавными
            let height = Math.floor(value * 5) + 5; // Высота от 0 до 10 + база 5

            // Создаем столбик блоков
            for (let y = 0; y <= height; y++) {
                // Если блок внутри холма (не видимый), можно не рисовать (оптимизация), 
                // но пока рисуем всё для простоты
                let mat = (y === height) ? matGrassTop : matDirt;
                
                const cube = new THREE.Mesh(geometry, mat);
                cube.position.set(x, y, z);
                scene.add(cube);
            }
        }
    }
}

// Управление движением
function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': moveState.up = true; break;
        case 'ShiftLeft': moveState.down = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
        case 'Space': moveState.up = false; break;
        case 'ShiftLeft': moveState.down = false; break;
    }
}

function onMouseMove(event) {
    if (!isGameRunning) return;
    
    // Вращение камеры мышью
    const sensitivity = 0.002;
    camera.rotation.y -= event.movementX * sensitivity;
    camera.rotation.x -= event.movementY * sensitivity;
    
    // Ограничение взгляда вверх/вниз (чтобы не кувыркаться)
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
}

// Обработка выхода из захвата курсора (ESC)
function onPointerLockChange() {
    if (document.pointerLockElement === document.body) {
        isGameRunning = true;
    } else {
        isGameRunning = false;
        // Показываем меню снова
        document.getElementById('menu-container').style.display = 'flex';
        document.getElementById('game-ui').style.display = 'none';
    }
}

function onWindowResize() {
    if(camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (isGameRunning) {
        // Логика движения
        const speed = 0.15; // Скорость полета
        
        // Получаем направление куда смотрит камера
        // Нам нужно двигаться только в плоскости XZ (как ходьба), 
        // но пока сделаем свободный полет (Creative mode)
        
        if (moveState.forward) {
            camera.translateX(0);
            camera.translateZ(-speed);
            // Если хотим ходить строго по земле, нужно убрать Y составляющую вектора
        }
        if (moveState.backward) {
            camera.translateX(0);
            camera.translateZ(speed);
        }
        if (moveState.left) {
            camera.translateX(-speed);
        }
        if (moveState.right) {
            camera.translateX(speed);
        }
        if (moveState.up) {
            camera.position.y += speed;
        }
        if (moveState.down) {
            camera.position.y -= speed;
        }
        
        // Обновляем текст отладки
        const x = Math.round(camera.position.x);
        const y = Math.round(camera.position.y);
        const z = Math.round(camera.position.z);
        document.getElementById('debug-info').innerText = `XYZ: ${x}, ${y}, ${z}`;
    }

    if(renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Старт инициализации текстов
updateTexts();