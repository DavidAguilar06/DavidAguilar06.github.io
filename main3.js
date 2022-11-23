// ========================================  ========================================
// Mtro. Adrián Guzmán - Clase: Introducción a las Tecnologías de Información.
// Referencia de las funciones de la librería p5.js: https://p5js.org/reference/
// Video tutorial utilizado como referencia para esta práctica: https://www.youtube.com/watch?v=-HHFKpps7fQ
// ======================================== Primera parte ========================================

// Inicializar variables
// 1
pelotaX = 200;
pelotaY = 50;
// 4
// movimientoPelotaX = 0;
// 10
movimientoPelotaX = 5;

// movimientoPelotaY = 1;
// 9
movimientoPelotaY = 0;
// 7
const gravedad = 1;

// Función setup() para definir el espacio y forma del 'canvas' en HTML.
// 1
function setup(){
    createCanvas(400, 300);
}

// Función draw() que 
// 1
function draw(){
    // color de fondo en RGB
    // 1
    background(0, 180, 150);

    // Mover la pelota
    // 8
    movimientoPelotaY = movimientoPelotaY + gravedad;
    // 5
    pelotaX = pelotaX + movimientoPelotaX;
    pelotaY = pelotaY + movimientoPelotaY;

    // Función rebote =============================================
    // 6
    if(pelotaY>290){
        movimientoPelotaY = movimientoPelotaY * -1;
    }

    // 11
    if(pelotaX>390){
        movimientoPelotaX = movimientoPelotaX * -1;
    }

    // 12
    if(pelotaX<10){
        movimientoPelotaX = movimientoPelotaX * -1;
    }

    // Dibujar la pelota 
    // Parámetros circle(coordenada_X, coordenada_Y, Diámetro)
    // 
    circle(pelotaX, pelotaY, 20);
    // Color de la pelota en RGB
    // 2
    fill(150, 254, 0);

    // Evento click con pelota
    // 13
    if(mouseIsPressed){
        pelotaX = mouseX;
        pelotaY = mouseY;
    }
}
