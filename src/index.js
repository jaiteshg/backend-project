import dotenv from "dotenv";


import { Mongoose } from "mongoose";
import {DB_NAME} from "./constants.js";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./env"
});


connectDB()
































// import express from "express";
// const app = express()

// (async () => {
//     try{
//         Mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
//         app.on("error", (er) =>{
//             console.log("Error :", error);
//             throw errorrror
//         } )

//         app.listen(process.env.PORT , () => {
//             console.log(`app is lisning on port ${process.env.PORT}`)
//         } )

//     }catch(error){
//         console.log("ERROR :",error);
//         throw error
//     }
// })()