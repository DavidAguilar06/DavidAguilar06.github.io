
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getDatabase, ref, set, update, get, onValue, onDisconnect, remove} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
    
    const firebaseConfig = {
        apiKey: "KEY",
        authDomain: "gato-4f1c3.firebaseapp.com",
        databaseURL: "https://gato-4f1c3-default-rtdb.firebaseio.com/",
        projectId: "gato-4f1c3",
        storageBucket: "gato-4f1c3.firebasestorage.app",
        messagingSenderId: "5901086131",
        appId: "1:5901086131:web:9eef46fd8044f7cfcbafc6"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    let salaActual = null;
    let miSimbolo = null;

    window.entrarSala = function() {
    const nombre = document.getElementById("nombre").value;
    const codigo = document.getElementById("codigoSala").value;

    if(!nombre || !codigo) return alert("Llena los campos");

    salaActual = codigo;
    const salaRef = ref(db, "salas/" + codigo);

    get(salaRef).then(snapshot => {
        if (!snapshot.exists()) {
            miSimbolo = "X";
            const nuevaSala = {
                jugador1: nombre,
                jugador2: null,
                tablero: Array(9).fill(""),
                turno: "X",
                estado: "esperando",
                victoriasX: 0,
                victoriasO: 0
            };
            set(salaRef, nuevaSala);
            
            onDisconnect(ref(db, `salas/${codigo}/jugador1`)).set(null);
        } else {
            const datos = snapshot.val();
            
            if (!datos.jugador1) {
                miSimbolo = "X";
                update(salaRef, { jugador1: nombre });
                onDisconnect(ref(db, `salas/${codigo}/jugador1`)).set(null);
            } else if (!datos.jugador2) {
                miSimbolo = "O";
                update(salaRef, { jugador2: nombre, estado: "jugando" });
                onDisconnect(ref(db, `salas/${codigo}/jugador2`)).set(null);
            } else {
                alert("Sala llena");
                return;
            }
        }
        entrarJuego();
    });
}

    window.escucharCambios = function() {
        onValue(ref(db, "salas/" + salaActual), (snapshot) => {
            const datos = snapshot.val();
            if (!datos) return;

            document.getElementById("n1").textContent = datos.jugador1;
            document.getElementById("n2").textContent = datos.jugador2 || "???";
            document.getElementById("v1").textContent = datos.victoriasX;
            document.getElementById("v2").textContent = datos.victoriasO;

            if (datos.estado === "esperando") {
                document.getElementById("info").textContent = "Esperando oponente...";
            } else {
                document.getElementById("info").textContent = "Turno de: " + datos.turno;
                actualizarTablero(datos.tablero);
                verificarGanadorLocal(datos);
            }
        });
    }

    window.jugar = function(pos) {
        const salaRef = ref(db, "salas/" + salaActual);
        get(salaRef).then(snapshot => {
            const datos = snapshot.val();
            if (datos.estado !== "jugando" || datos.turno !== miSimbolo || datos.tablero[pos] !== "") return;

            let nuevoTablero = [...datos.tablero];
            nuevoTablero[pos] = miSimbolo;
            
            const ganador = calcularGanador(nuevoTablero);
            let actualizaciones = { 
                tablero: nuevoTablero, 
                turno: miSimbolo === "X" ? "O" : "X" 
            };

            if (ganador) {
                if (ganador === "X") actualizaciones.victoriasX = datos.victoriasX + 1;
                if (ganador === "O") actualizaciones.victoriasO = datos.victoriasO + 1;
                actualizaciones.estado = "terminado";
                alert("¡Ganó " + ganador + "!");
            } else if (!nuevoTablero.includes("")) {
                actualizaciones.estado = "terminado";
                alert("¡Empate!");
            }

            update(salaRef, actualizaciones);
        });
    }

    window.reiniciarPartida = function() {
        update(ref(db, "salas/" + salaActual), {
            tablero: Array(9).fill(""),
            turno: "X",
            estado: "jugando"
        });
    }

    window.salirSala = function() {
        if (!salaActual) return;  
        const salaRef = ref(db, "salas/" + salaActual);
        const campoJugador = miSimbolo === "X" ? "jugador1" : "jugador2";
        const actualizaciones = {};
        actualizaciones[campoJugador] = null;
        if (miSimbolo === "O") actualizaciones["estado"] = "esperando";

        update(salaRef, actualizaciones).then(() => {
            get(salaRef).then(snap => {
                const d = snap.val();
                if (!d.jugador1 && !d.jugador2) {
                    remove(salaRef);
                }
                location.reload();
            });
        });
    }

    window.actualizarTablero = function(tablero) {
        const botones = document.querySelectorAll(".celda");
        tablero.forEach((val, i) => botones[i].textContent = val);
    }

    window.calcularGanador = function(t) {
        const lineas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (let [a,b,c] of lineas) {
            if (t[a] && t[a] === t[b] && t[a] === t[c]) return t[a];
        }
        return null;
    }

    window.verificarGanadorLocal = function(datos) {
        if(datos.estado === "terminado") {
            document.getElementById("info").textContent = "¡Partida finalizada!";
        }
    }
    window.entrarJuego = function() {
    document.getElementById("menu").style.display = "none";
    document.getElementById("juego").style.display = "block";

    const salaRef = ref(db, "salas/" + salaActual);

    onValue(salaRef, (snapshot) => {
        const datos = snapshot.val();
        if (!datos) return;

        if (miSimbolo === "X" && !datos.jugador2) {
            document.getElementById("info").textContent = "El oponente salió. Esperando...";
        }

        document.getElementById("n1").textContent = datos.jugador1 || "Vacío";
        document.getElementById("n2").textContent = datos.jugador2 || "Vacío";
        document.getElementById("v1").textContent = datos.victoriasX;
        document.getElementById("v2").textContent = datos.victoriasO;

        if (datos.estado === "esperando") {
            document.getElementById("info").textContent = "Esperando oponente...";
        } else {
            document.getElementById("info").textContent = "Turno de: " + datos.turno;
            actualizarTablero(datos.tablero);
        }
    });
}