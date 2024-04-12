import dotenv from "dotenv";


import { Mongoose } from "mongoose";
import {DB_NAME} from "./constants.js";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./env"
});


connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000), () => {
        console.log(`app is lisning on port ${process.env.PORT}`)}
    
})
.catch((error) => {
    console.log("MongoDB connection fails!!! ",error);
    })
