// connect from React with plain io() and no URL

import { io } from "socket.io-client";

const socket = io();

export default socket;
