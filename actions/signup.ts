"use server"
import Userodel from "@/models/userodel"
import ConnectDb from '@/database/db_configure'
import { userrsignup, AuthActionResult } from "@/types/user"
import bcrypt from 'bcrypt'
import { ensureLegacyUsernames, isUsernameTaken } from "@/lib/auth-server"
import { normalizeUsername, sanitizeUsername, validatePasswordInput, validateUsernameInput } from "@/lib/auth"

export default async function Signup(Userata:userrsignup):Promise<AuthActionResult>{
   await ConnectDb()
   try{
    await ensureLegacyUsernames()

    const username=sanitizeUsername(Userata.username)
    const password=Userata.password ?? ""

    const usernameError=validateUsernameInput(username)
    if(usernameError){
      return {success:false,code:"validation_error",message:usernameError}
    }

    const passwordError=validatePasswordInput(password)
    if(passwordError){
      return {success:false,code:"validation_error",message:passwordError}
    }

    const usernameAlreadyTaken=await isUsernameTaken(username)
    if(usernameAlreadyTaken){
      return {
        success:false,
        code:"username_taken",
        message:"Username already exists. Please choose another one.",
      }
    }

    const hashedPassword=await bcrypt.hash(password,6)
    await new Userodel({
      name:username,
      username,
      usernameLower:normalizeUsername(username),
      password:hashedPassword,
      failedLoginAttempts:0,
      lockUntil:null,
    }).save()

    return {
      success:true,
      code:"success",
      message:"Account created successfully.",
      username,
    }
   }
   catch(error:unknown){
    const databaseError=error as {code?:number}
    if(databaseError.code===11000){
      return {
        success:false,
        code:"username_taken",
        message:"Username already exists. Please choose another one.",
      }
    }

    return {
      success:false,
      code:"server_error",
      message:"We could not create your account right now. Please try again.",
    }
   }
}
