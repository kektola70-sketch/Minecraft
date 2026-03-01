class Inventory {
    constructor() {
        this.selectedSlot = 0;
        this.blocks = [
            { id: 1, color: 0x567d46, name: "Grass" },   // 1. Трава
            { id: 2, color: 0x795548, name: "Dirt" },    // 2. Земля
            { id: 3, color: 0x808080, name: "Stone" },   // 3. Камень
            { id: 4, color: 0xA0522D, name: "Wood" },    // 4. Дерево
            { id: 5, color: 0x228B22, name: "Leaves" },  // 5. Листва (Зеленая)
            { id: 6, color: 0xF4A460, name: "Sand" },    // 6. Песок
            { id: 7, color: 0xFFFFFF, name: "Snow" },    // 7. Снег
            { id: 8, color: 0x111111, name: "Bedrock" }, // 8. Бедрок
            { id: 9, color: 0x0000FF, name: "Water" }    // 9. Вода
        ];
        this.initUI();
    }
    initUI() {
        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, index) => {
            if (this.blocks[index]) {
                const color = '#' + this.blocks[index].color.toString(16).padStart(6, '0');
                slot.style.backgroundColor = color;
            }
            slot.addEventListener('click', () => { this.selectSlot(index); });
            slot.addEventListener('touchstart', (e) => { e.preventDefault(); this.selectSlot(index); });
        });
    }
    selectSlot(index) {
        if (index < 0) index = 8; if (index > 8) index = 0;
        this.selectedSlot = index;
        document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.hotbar-slot')[this.selectedSlot].classList.add('active');
    }
    getSelectedBlock() { return this.blocks[this.selectedSlot]; }
}