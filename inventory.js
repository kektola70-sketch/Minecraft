class Inventory {
    constructor() {
        this.selectedSlot = 0;
        this.mode = 'creative'; // По умолчанию
        
        // Ссылки на текстуры (используем GitHub CDN для надежности)
        const path = "https://raw.githubusercontent.com/joshwcomeau/react-three-fiber-minecraft/master/public/textures/";
        // Запасной путь для простых блоков, если первых нет
        
        this.blocks = [
            { id: 1, name: "Grass", texture: path + "grass.jpg", side: path + "grass_dirt.jpg", type: 'grass' },
            { id: 2, name: "Dirt", texture: path + "dirt.jpg", type: 'dirt' },
            { id: 3, name: "Stone", texture: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/cobblestone.png", type: 'stone' },
            { id: 4, name: "Wood", texture: path + "wood.jpg", type: 'wood' },
            { id: 5, name: "Leaves", texture: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/grass_dirt.png", color: 0x228B22, type: 'leaves' }, // Тинтуем зелёным
            { id: 6, name: "Sand", texture: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/sand.png", type: 'sand' },
            { id: 7, name: "Glass", texture: path + "glass.png", transparent: true, type: 'glass' },
            { id: 8, name: "Brick", texture: "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/brick.png", type: 'brick' },
            { id: 9, name: "Obsidian", texture: path + "obsidian.jpg", type: 'obsidian' }
        ];

        // Слоты инвентаря (могут быть пустыми)
        this.slots = new Array(9).fill(null);
        
        this.initUI();
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'survival' || mode === 'hardcore') {
            // В выживании инвентарь пустой
            this.slots.fill(null);
        } else {
            // В креативе заполняем всеми блоками
            for(let i=0; i<9; i++) {
                this.slots[i] = this.blocks[i] || null;
            }
        }
        this.updateUI();
    }

    initUI() {
        const slotsUI = document.querySelectorAll('.hotbar-slot');
        slotsUI.forEach((slot, index) => {
            slot.addEventListener('click', () => { this.selectSlot(index); });
            slot.addEventListener('touchstart', (e) => { e.preventDefault(); this.selectSlot(index); });
        });
        this.updateUI();
    }

    updateUI() {
        const slotsUI = document.querySelectorAll('.hotbar-slot');
        slotsUI.forEach((slot, index) => {
            const item = this.slots[index];
            if (item) {
                // Если есть текстура, ставим на фон
                if (item.texture) {
                    slot.style.backgroundImage = `url('${item.texture}')`;
                    slot.style.backgroundColor = 'transparent';
                } else if (item.color) {
                    slot.style.backgroundColor = '#' + item.color.toString(16).padStart(6,'0');
                    slot.style.backgroundImage = 'none';
                }
            } else {
                slot.style.backgroundImage = 'none';
                slot.style.backgroundColor = 'rgba(0,0,0,0.3)';
            }
        });
    }

    selectSlot(index) {
        if (index < 0) index = 8; if (index > 8) index = 0;
        this.selectedSlot = index;
        document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.hotbar-slot')[this.selectedSlot].classList.add('active');
        
        // Обновляем руку (визуально) в script.js, отправляя событие или просто читая getSelectedBlock
    }

    getSelectedBlock() { return this.slots[this.selectedSlot]; }
    
    // Метод для подбора блоков (на будущее)
    addItem(blockType) {
        // Найти первый пустой слот
        const emptyIndex = this.slots.indexOf(null);
        if (emptyIndex !== -1) {
             // Находим блок по типу
             const block = this.blocks.find(b => b.type === blockType);
             if(block) {
                 this.slots[emptyIndex] = block;
                 this.updateUI();
             }
        }
    }
}