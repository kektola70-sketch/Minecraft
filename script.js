/* ==========================================
   ПЕРЕМЕННЫЕ И ДАННЫЕ
   ========================================== */
let scene, camera, renderer, raycaster;
let inventory;
let terrainMeshes = [];
let isGameInitialized = false;
let isGameRunning = false;
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

const translations = {
    ru: {
        singleplayer: "Одиночная игра", multiplayer: "Сетевая игра", settings: "Настройки",
        language: "Язык", quit: "Выйти", select_world: "Выбор мира", play_world: "Играть",
        cancel: "Отмена", done: "Готово", fov_prefix: "Поле зрения: ", render_prefix: "Прорисовка: ", music_prefix: "Музыка: "
    },
    en: {
        singleplayer: "Singleplayer", multiplayer: "Multiplayer", settings: "Settings",
        language: "Language", quit: "Quit Game", select_world: "Select World", play_world: "Play",
        cancel: "Cancel", done: "Done", fov_prefix: "FOV: ", render_prefix: "Render Dist: ", music_prefix: "Music: "
    }
};

let currentLang = 'ru';
let gameSettings = { fov: 75, renderDist: 8, music: false };

// Сплэши
const splashes = ["Beta version!", "Use Chrome!", "Breaking blocks!", "Not Minecraft!", "Hello!"];
document.getElementById('splash-text').innerText = splashes[Math.floor(Math.random() * splashes.length)];

/* ==========================================
   СИСТЕМА МЕНЮ (ИСПРАВЛЕНА)
   ========================================== */

function showScreen(screenId) {
    // 1. Показываем главный контейнер меню (черный экран пропадает)
    document.getElementById('menu-container').style.display = 'flex';
    
    // 2. Скрываем интерфейс игры
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';

    // 3. Переключаем активную вкладку (Main -> Settings и т.д.)
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId + '-screen');
    if (target) target.classList.add('active');
    else console.error("Screen not found:", screenId); // Для отладки
    
    // 4. Останавливаем логику игры
    isGameRunning = false;
    
    // 5. Выходим из захвата мыши
    if(document.pointerLockElement) document.exitPointerLock();
}

function openMenuFromGame() {
    showScreen('main-menu');
}

function startGame() {
    // Скрываем меню
    document.getElementById('menu-container').style.display = 'none';
    
    // Показываем интерфейс
    document.getElementById('game-ui').style.display = 'block';
    
    // Проверка на мобилу
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if(isMobile || window.innerWidth < 800) {
        document.getElementById('mobile-controls').style.display = 'block';
    }

    if (!isGameInitialized) {
        initGame();
        initControls();
        isGameInitialized = true;
    }
    
    isGameRunning = true;
    
    if(!isMobile) {
        try { document.body.requestPointerLock(); } catch(e) {}
    }
}

// Настройки
function toggleSetting(key) {
    if (key === 'fov') gameSettings.fov = gameSettings.fov === 75 ? 90 : (gameSettings.fov === 90 ? 110 : 75);
    else if (key === 'render') gameSettings.renderDist = gameSettings.renderDist === 8 ? 16 : (gameSettings.renderDist === 16 ? 4 : 8);
    else if (key === 'music') gameSettings.music = !gameSettings.music;
    
    updateSettingsButtons();
    
    // Применяем настройки к игре
    if(camera) {
        camera.fov = gameSettings.fov;
        camera.updateProjectionMatrix();
        if(scene && scene.fog) scene.fog.far = gameSettings.renderDist * 10;
    }
}

function updateSettingsButtons() {
    const t = translations[currentLang];
    document.getElementById('btn-fov').innerText = t.fov_prefix + gameSettings.fov;
    document.getElementById('btn-render').innerText = t.render_prefix + gameSettings.renderDist;
    document.getElementById('btn-music').innerText = t.music_prefix + (gameSettings.music ? "ON" : "OFF");
}

function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[currentLang][key]) el.innerText = translations[currentLang][key];
    });
    updateSettingsButtons();
}

function exitGame() { if(confirm("Закрыть окно?")) window.close(); }

/* ==========================================
   ИГРОВОЙ ДВИЖОК
   ========================================== */

function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 60);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(16, 15, 16);
    camera.rotation.order = 'YXZ'; 

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    inventory = new Inventory();
    raycaster = new THREE.Raycaster();
    raycaster.far = 6; 

    generateChunk();
    animate();
    
    updateSettingsButtons(); // Обновить тексты при старте
    setLanguage('ru');
}

function generateChunk() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const simplex = new SimplexNoise();
    
    for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
            let height = Math.floor(simplex.noise2D(x/15, z/15) * 4) + 5;
            for (let y = 0; y <= height; y++) {
                if (y === height || x===0 || x===19 || z===0 || z===19) {
                    let color = (y === height) ? 0x567d46 : 0x795548;
                    const material = new THREE.MeshLambertMaterial({ color: color });
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.set(x, y, z);
                    scene.add(cube);
                    terrainMeshes.push(cube);
                }
            }
        }
    }
}

// ЛОГИКА БЛОКОВ
function getIntersection() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(terrainMeshes);
    return intersects.length > 0 ? intersects[0] : null;
}

function breakBlock() {
    const intersect = getIntersection();
    if (intersect) {
        scene.remove(intersect.object);
        terrainMeshes.splice(terrainMeshes.indexOf(intersect.object), 1);
        intersect.object.geometry.dispose();
        intersect.object.material.dispose();
    }
}

function placeBlock() {
    const intersect = getIntersection();
    if (intersect) {
        const voxelId = intersect.object.position.clone().add(intersect.face.normal);
        
        // Проверка коллизии с игроком
        const p = camera.position;
        if (Math.abs(p.x - voxelId.x) < 0.8 && Math.abs(p.y - voxelId.y) < 1.8 && Math.abs(p.z - voxelId.z) < 0.8) return;

        const blockData = inventory.getSelectedBlock();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: blockData.color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(voxelId);
        scene.add(cube);
        terrainMeshes.push(cube);
    }
}

// УПРАВЛЕНИЕ
function initControls() {
    // Клавиатура
    document.addEventListener('keydown', (e) => {
        if(e.code === 'KeyW') moveState.forward = true;
        if(e.code === 'KeyS') moveState.backward = true;
        if(e.code === 'KeyA') moveState.left = true;
        if(e.code === 'KeyD') moveState.right = true;
        if(e.code === 'Space') moveState.up = true;
        if(e.code === 'ShiftLeft') moveState.down = true;
        if(e.key >= 1 && e.key <= 9) inventory.selectSlot(parseInt(e.key) - 1);
    });
    
    document.addEventListener('keyup', (e) => {
        if(e.code === 'KeyW') moveState.forward = false;
        if(e.code === 'KeyS') moveState.backward = false;
        if(e.code === 'KeyA') moveState.left = false;
        if(e.code === 'KeyD') moveState.right = false;
        if(e.code === 'Space') moveState.up = false;
        if(e.code === 'ShiftLeft') moveState.down = false;
    });

    // Мышь
    document.addEventListener('mousedown', (e) => {
        if (!isGameRunning || e.target.classList.contains('hotbar-slot')) return;
        if (document.pointerLockElement === document.body) {
            if (e.button === 0) breakBlock();
            if (e.button === 2) placeBlock();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isGameRunning || document.pointerLockElement !== document.body) return;
        camera.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
    });

    // Мобильное управление
    const bindBtn = (id, key) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); moveState[key] = false; });
    };
    bindBtn('btn-fwd', 'forward'); bindBtn('btn-back', 'backward');
    bindBtn('btn-left', 'left'); bindBtn('btn-right', 'right');
    bindBtn('btn-up', 'up'); bindBtn('btn-down', 'down');

    document.getElementById('btn-break').addEventListener('touchstart', (e) => { e.preventDefault(); breakBlock(); });
    document.getElementById('btn-place').addEventListener('touchstart', (e) => { e.preventDefault(); placeBlock(); });

    // Свайп камеры
    let lastX = 0, lastY = 0;
    document.addEventListener('touchstart', (e) => {
        if(!e.target.classList.contains('control-btn') && !e.target.classList.contains('hotbar-slot')) {
            lastX = e.touches[0].pageX; lastY = e.touches[0].pageY;
        }
    }, {passive: false});

    document.addEventListener('touchmove', (e) => {
        if (!isGameRunning || e.target.classList.contains('control-btn')) return;
        const dx = e.touches[0].pageX - lastX;
        const dy = e.touches[0].pageY - lastY;
        camera.rotation.y -= dx * 0.005;
        camera.rotation.x -= dy * 0.005;
        camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
        lastX = e.touches[0].pageX; lastY = e.touches[0].pageY;
    }, {passive: false});
}

function animate() {
    requestAnimationFrame(animate);
    if (isGameRunning) {
        const speed = 0.15;
        const angle = camera.rotation.y;
        if (moveState.forward) { camera.position.x -= Math.sin(angle)*speed; camera.position.z -= Math.cos(angle)*speed; }
        if (moveState.backward) { camera.position.x += Math.sin(angle)*speed; camera.position.z += Math.cos(angle)*speed; }
        if (moveState.left) { camera.position.x -= Math.sin(angle+Math.PI/2)*speed; camera.position.z -= Math.cos(angle+Math.PI/2)*speed; }
        if (moveState.right) { camera.position.x += Math.sin(angle+Math.PI/2)*speed; camera.position.z += Math.cos(angle+Math.PI/2)*speed; }
        if (moveState.up) camera.position.y += speed;
        if (moveState.down) camera.position.y -= speed;
        
        const p = camera.position;
        document.getElementById('debug-info').innerText = `XYZ: ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    }
    if(renderer && scene) renderer.render(scene, camera);
}