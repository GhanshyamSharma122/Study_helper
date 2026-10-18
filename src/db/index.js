import mongoose from "mongoose"
import {DB_NAME} from "../constants.js"
import {MongoMemoryServer} from "mongodb-memory-server"

let mogod=await MongoMemoryServer.create({
    instance:{
        dbName:DB_NAME,
        dbPath:"C:/Users/shyam/OneDrive/Desktop/Study helper/my-mongo-data",
        storageEngine:"wiredTiger"
    },
})
const uri=mogod.getUri();

const connectDB=async ()=>{
    try {
        const connectionInstance=await mongoose.connect(uri)
        console.log(`\n mongodb connected  db host ${connectionInstance.connection.host}`)
        
    } catch (error) {
        console.log("mongodb connection failed",error);
        process.exit(1);
    }
}
export default connectDB