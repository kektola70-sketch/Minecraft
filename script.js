/* ==========================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
   ========================================== */
let scene, camera, renderer;
let inventory;
let raycaster; // Для определения блока под прицелом

let isGameInitialized = false;
let isGameRunning = false;
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

// Массивы для хранения мешей чанков (для оптимизации raycast)
let terrainMeshes = [];

/* ==========================================
   УПРАВЛЕНИЕ ЭКРАНАМИ (ИСПРАВЛЕНИЕ ЧЕРНОГО ЭКРАНА)
   ========================================== */

function showScreen(screenId) {
    // 1. Показываем контейнер меню
    const menuContainer = document.getElementById('menu-container');
    menuContainer.style.display = 'flex'; // ВАЖНО: Flex для центрирования
    
    // 2. Скрываем интерфейс игры
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';

    // 3. Переключаем вкладки внутри меню
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + '-screen').classList.add('active');
    
    // 4. Останавливаем логику игры
    isGameRunning = false;
    
    // 5. Выходим из захвата курсора
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
    
    // Проверка мобильного устройства (грубая)
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
    
    // Захват курсора (только для ПК)
    if(!isMobile) {
        try {
            document.body.requestPointerLock();
        } catch(e) {}
    }
}

function exitGame() { if(confirm("Закрыть?")) window.close(); }

/* ==========================================
   ИГРОВОЙ ДВИЖОК
   ========================================== */

function initGame() {
    // Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 60); // Туман

    // Камера
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(16, 15, 16);
    camera.rotation.order = 'YXZ'; 

    // Рендер
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    // Свет
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // Инвентарь
    inventory = new Inventory();
    
    // Raycaster (луч из центра экрана)
    raycaster = new THREE.Raycaster();
    raycaster.far = 8; // Дистанция взаимодействия (8 блоков)

    // Генерация мира
    generateChunk();

    // Цикл
    animate();
}

function generateChunk() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const simplex = new SimplexNoise();
    
    for (let x = 0; x < 20; x++) {
        for (let z = 0; z < 20; z++) {
            let height = Math.floor(simplex.noise2D(x/15, z/15) * 4) + 5;
            for (let y = 0; y <= height; y++) {
                // Визуально скрываем внутренние блоки
                if (y === height || x===0 || x===19 || z===0 || z===19) {
                    let color = (y === height) ? 0x567d46 : 0x795548;
                    const material = new THREE.MeshLambertMaterial({ color: color });
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.set(x, y, z);
                    scene.add(cube);
                    terrainMeshes.push(cube); // Добавляем в список для взаимодействия
                }
            }
        }
    }
}

/* ==========================================
   ЛОГИКА СТРОИТЕЛЬСТВА (Raycasting)
   ========================================== */

function getIntersection() {
    // Луч пускается ровно из центра камеры
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(terrainMeshes);
    if (intersects.length > 0) {
        return intersects[0];
    }
    return null;
}

function breakBlock() {
    const intersect = getIntersection();
    if (intersect) {
        const object = intersect.object;
        scene.remove(object); // Удалить из сцены
        // Удалить из массива terrainMeshes
        const index = terrainMeshes.indexOf(object);
        if (index > -1) terrainMeshes.splice(index, 1);
        
        // Очистка памяти (важно для производительности)
        object.geometry.dispose();
        object.material.dispose();
    }
}

function placeBlock() {
    const intersect = getIntersection();
    if (intersect) {
        // Получаем координаты, куда ставить, на основе нормали (стороны грани)
        const voxelId = intersect.object.position.clone().add(intersect.face.normal);
        
        // Не ставить блок в самого игрока
        const playerPos = camera.position.clone();
        if (Math.abs(playerPos.x - voxelId.x) < 0.8 && 
            Math.abs(playerPos.y - voxelId.y) < 1.8 && 
            Math.abs(playerPos.z - voxelId.z) < 0.8) {
            return; 
        }

        const selectedBlock = inventory.getSelectedBlock();
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: selectedBlock.color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(voxelId);
        
        scene.add(cube);
        terrainMeshes.push(cube);
    }
}

/* ==========================================
   УПРАВЛЕНИЕ
   ========================================== */

function initControls() {
    // Клавиатура
    document.addEventListener('keydown', (e) => {
        if(e.code === 'KeyW') moveState.forward = true;
        if(e.code === 'KeyS') moveState.backward = true;
        if(e.code === 'KeyA') moveState.left = true;
        if(e.code === 'KeyD') moveState.right = true;
        if(e.code === 'Space') moveState.up = true;
        if(e.code === 'ShiftLeft') moveState.down = true;
        // Цифры для слотов
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

    // Мышь (ПК) - ЛКМ ломает, ПКМ ставит
    document.addEventListener('mousedown', (e) => {
        if (!isGameRunning) return;
        if (e.target.classList.contains('hotbar-slot')) return; // Игнорировать клики по UI
        
        if (document.pointerLockElement === document.body) {
            if (e.button === 0) breakBlock(); // ЛКМ
            if (e.button === 2) placeBlock(); // ПКМ
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isGameRunning || document.pointerLockElement !== document.body) return;
        camera.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== document.body && isGameRunning) {
             // Если потеряли фокус на ПК, не выбрасываем в меню сразу, 
             // просто останавливаем вращение камерой.
        }
    });

    // Колесико мыши (смена слотов)
    document.addEventListener('wheel', (e) => {
        if(!isGameRunning) return;
        if(e.deltaY > 0) inventory.selectSlot(inventory.selectedSlot + 1);
        else inventory.selectSlot(inventory.selectedSlot - 1);
    });

    // --- МОБИЛЬНЫЕ КНОПКИ ---
    const bindBtn = (id, key) => {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); moveState[key] = false; });
    };
    bindBtn('btn-fwd', 'forward'); bindBtn('btn-back', 'backward');
    bindBtn('btn-left', 'left'); bindBtn('btn-right', 'right');
    bindBtn('btn-up', 'up'); bindBtn('btn-down', 'down');

    // Кнопки действий
    document.getElementById('btn-break').addEventListener('touchstart', (e) => {
        e.preventDefault(); breakBlock();
    });
    document.getElementById('btn-place').addEventListener('touchstart', (e) => {
        e.preventDefault(); placeBlock();
    });

    // Свайп камеры
    let lastTouchX = 0, lastTouchY = 0;
    document.addEventListener('touchstart', (e) => {
        if(!e.target.classList.contains('control-btn') && !e.target.classList.contains('hotbar-slot')) {
            lastTouchX = e.touches[0].pageX;
            lastTouchY = e.touches[0].pageY;
        }
    }, {passive: false});

    document.addEventListener('touchmove', (e) => {
        if (!isGameRunning) return;
        if(e.target.classList.contains('control-btn') || e.target.classList.contains('hotbar-slot')) return;
        
        const dx = e.touches[0].pageX - lastTouchX;
        const dy = e.touches[0].pageY - lastTouchY;
        
        camera.rotation.y -= dx * 0.005;
        camera.rotation.x -= dy * 0.005;
        camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
        
        lastTouchX = e.touches[0].pageX;
        lastTouchY = e.touches[0].pageY;
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