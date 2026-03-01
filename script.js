// Список фраз для желтого текста
const splashes = [
    "JavaScript Edition!",
    "100% web based!",
    "No Java required!",
    "Check the console!",
    "Hello World!",
    "Creeper? Aww man!",
    "Undefined is not a function!"
];

// Установка случайного сплэша при загрузке
document.addEventListener('DOMContentLoaded', () => {
    const splashElement = document.getElementById('splash-text');
    const randomSplash = splashes[Math.floor(Math.random() * splashes.length)];
    splashElement.innerText = randomSplash;
});

// Функция переключения экранов
function showScreen(screenId) {
    // Скрываем все экраны
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    // Показываем нужный экран
    const targetScreen = document.getElementById(screenId + '-screen') || document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// Заглушка для выхода
function exitGame() {
    if (confirm("Вы действительно хотите закрыть вкладку?")) {
        window.close();
    }
}

// Заглушка для начала игры (переход к рендерингу мира - следующий этап)
function startGame() {
    alert("Генерация мира... (Этот функционал мы добавим на следующем этапе)");
    // Здесь мы скроем меню и инициализируем Canvas/WebGL
}