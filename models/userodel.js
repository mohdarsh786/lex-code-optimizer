import mongoose from 'mongoose'
import { models } from 'mongoose'
const Usrodel=new mongoose.Schema({
    name:{type:String},
    username:{type:String,trim:true},
    usernameLower:{type:String,trim:true,lowercase:true,unique:true,sparse:true,index:true},
    password:{type:String,required:true},
    failedLoginAttempts:{type:Number,default:0},
    lockUntil:{type:Date,default:null},
    lastLoginAt:{type:Date},
    email:{type:String},
    createdAt:{type:Date,default:Date.now}
})
export default models.userodel || mongoose.model("userodel",Usrodel)
