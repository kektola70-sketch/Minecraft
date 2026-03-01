class Inventory {
    constructor() {
        this.selectedSlot = 0;
        // Список доступных блоков (цвета для простоты)
        this.blocks = [
            { id: 1, color: 0x567d46, name: "Grass" },  // 0: Трава
            { id: 2, color: 0x795548, name: "Dirt" },   // 1: Земля
            { id: 3, color: 0x888888, name: "Stone" },  // 2: Камень
            { id: 4, color: 0xA0522D, name: "Wood" },   // 3: Дерево
            { id: 5, color: 0xFFD700, name: "Gold" },   // 4: Золото
            { id: 6, color: 0xFFFFFF, name: "Iron" },   // 5: Железо
            { id: 7, color: 0x0000FF, name: "Water" },  // 6: Вода (блок)
            { id: 8, color: 0xFF0000, name: "TNT" },    // 7: ТНТ
            { id: 9, color: 0x000000, name: "Bedrock" } // 8: Бедрок
        ];
        
        this.initUI();
    }

    initUI() {
        // Отрисовка цветов в слотах
        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, index) => {
            if (this.blocks[index]) {
                const color = '#' + this.blocks[index].color.toString(16).padStart(6, '0');
                slot.style.backgroundColor = color;
            }
            
            // Клик по слоту (для ПК)
            slot.addEventListener('click', () => {
                this.selectSlot(index);
            });
            
            // Тач по слоту
            slot.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Чтобы не нажималось сквозь
                this.selectSlot(index);
            });
        });

        // Скролл колесиком (в script.js будет обработчик)
    }

    selectSlot(index) {
        if (index < 0) index = 8;
        if (index > 8) index = 0;
        
        this.selectedSlot = index;
        
        // Обновляем UI
        document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.hotbar-slot')[this.selectedSlot].classList.add('active');
    }

    getSelectedBlock() {
        return this.blocks[this.selectedSlot];
    }
}