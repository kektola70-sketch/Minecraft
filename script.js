/* --- ЧАСТЬ 1: ДАННЫЕ И НАСТРОЙКИ --- */

// Словари переводов
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

// Текущие настройки
let currentLang = 'ru';
let gameSettings = {
    fov: 75,
    renderDist: 8,
    music: false
};

// Инициализация сплэшей
const splashes = ["3D World!", "Three.js Power!", "Blocks everywhere!", "Press ESC to menu"];
document.getElementById('splash-text').innerText = splashes[Math.floor(Math.random() * splashes.length)];

/* --- ЧАСТЬ 2: ФУНКЦИИ МЕНЮ --- */

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + '-screen').classList.add('active');
}

// Смена языка
function setLanguage(lang) {
    currentLang = lang;
    updateTexts();
}

// Обновление всех текстов на странице
function updateTexts() {
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        if (translations[currentLang][key]) {
            el.innerText = translations[currentLang][key];
        }
    });
    updateSettingsButtons(); // Обновить текст кнопок настроек
}

// Логика переключения настроек
function toggleSetting(key) {
    if (key === 'fov') {
        gameSettings.fov = gameSettings.fov === 75 ? 90 : (gameSettings.fov === 90 ? 110 : 75);
    } else if (key === 'renderDist') {
        gameSettings.renderDist = gameSettings.renderDist === 8 ? 16 : (gameSettings.renderDist === 16 ? 4 : 8);
    } else if (key === 'music') {
        gameSettings.music = !gameSettings.music;
    }
    updateSettingsButtons();
}

function updateSettingsButtons() {
    const t = translations[currentLang];
    document.getElementById('btn-fov').innerText = t.fov_prefix + gameSettings.fov;
    document.getElementById('btn-render').innerText = t.render_prefix + gameSettings.renderDist;
    document.getElementById('btn-music').innerText = t.music_prefix + (gameSettings.music ? "ON" : "OFF");
}

function exitGame() { window.close(); }

// Применить настройки (обновить камеру если игра запущена)
function applySettings() {
    if (camera) {
        camera.fov = gameSettings.fov;
        camera.updateProjectionMatrix();
    }
}

/* --- ЧАСТЬ 3: ИГРОВОЙ ДВИЖОК (THREE.JS) --- */

let scene, camera, renderer, animationId;
let chunks = []; // Хранилище блоков

function startGame() {
    // Скрываем меню
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';

    init3D();
}

function init3D() {
    // 1. Создаем сцену
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Небесно-голубой
    scene.fog = new THREE.Fog(0x87CEEB, 10, gameSettings.renderDist * 10);

    // 2. Камера
    camera = new THREE.PerspectiveCamera(gameSettings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // 3. Рендерер
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-world').appendChild(renderer.domElement);

    // 4. Свет
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // 5. Генерация мира
    generateWorld();

    // 6. Управление камерой (простой полёт)
    camera.position.set(16, 20, 16);
    camera.lookAt(20, 15, 20);

    // Запуск цикла анимации
    animate();
    
    // Обработка клавиш для выхода в меню
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            document.getElementById('game-container').style.display = 'flex';
            document.getElementById('game-ui').style.display = 'none';
            // Остановить рендер можно тут, если нужно
        }
    });
}

function generateWorld() {
    // Используем SimplexNoise для генерации ландшафта
    const simplex = new SimplexNoise();
    
    // Материалы
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x55aa55 }); // Зеленая трава
    const dirtMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });  // Коричневая земля
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); // Серый камень
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Размер мира (16x16 чанк)
    const size = 32; 

    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            // Генерация высоты (шум Перлина)
            // Делим на 15, чтобы холмы были плавными
            let value = simplex.noise2D(x / 15, z / 15); 
            let height = Math.floor(Math.abs(value) * 10) + 1; // Высота от 1 до 10 блоков

            for (let y = 0; y < height; y++) {
                let mat = stoneMat;
                if (y === height - 1) mat = grassMat; // Верхний блок - трава
                else if (y > height - 4) mat = dirtMat; // Блоки под травой - земля

                const cube = new THREE.Mesh(geometry, mat);
                cube.position.set(x, y, z);
                scene.add(cube);
            }
        }
    }
}

// Переменные для вращения камеры мышкой
let isGameActive = true;
let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', (event) => {
    if(document.getElementById('game-container').style.display === 'none') {
        // Простая имитация поворота камеры
        camera.rotation.y -= event.movementX * 0.002;
        camera.rotation.x -= event.movementY * 0.002;
    }
});

// Движение клавишами WASD
document.addEventListener('keydown', (event) => {
    const speed = 0.5;
    if(document.getElementById('game-container').style.display === 'none') {
        switch(event.code) {
            case 'KeyW': camera.translateZ(-speed); break;
            case 'KeyS': camera.translateZ(speed); break;
            case 'KeyA': camera.translateX(-speed); break;
            case 'KeyD': camera.translateX(speed); break;
            case 'Space': camera.position.y += speed; break;
            case 'ShiftLeft': camera.position.y -= speed; break;
        }
    }
});

function animate() {
    requestAnimationFrame(animate);
    
    // Обновляем инфо
    if (camera) {
        document.getElementById('debug-info').innerText = 
            `XYZ: ${Math.round(camera.position.x)}, ${Math.round(camera.position.y)}, ${Math.round(camera.position.z)}`;
        renderer.render(scene, camera);
    }
}

// Инициализация текстов при старте
updateTexts();