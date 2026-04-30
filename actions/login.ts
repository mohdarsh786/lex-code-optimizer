"use server"
import ConnectDB from '@/database/db_configure'
import { userrlogin, AuthActionResult } from '@/types/user'
import bcrypt from 'bcrypt'
import { clearExpiredLock, ensureLegacyUsernames, findUserByUsername, getLockStatus, registerFailedLoginAttempt } from '@/lib/auth-server'
import { sanitizeUsername, validatePasswordPresence, validateUsernamePresence } from '@/lib/auth'

export default async function Login(Userata:userrlogin):Promise<AuthActionResult>{
    await ConnectDB()

    try{
        await ensureLegacyUsernames()

        const username=sanitizeUsername(Userata.username)
        const password=Userata.password ?? ""

        const usernameError=validateUsernamePresence(username)
        if(usernameError){
            return {success:false,code:"validation_error",message:usernameError}
        }

        const passwordError=validatePasswordPresence(password)
        if(passwordError){
            return {success:false,code:"validation_error",message:passwordError}
        }

        const userata=await findUserByUsername(username)
        if(!userata){
            return {
                success:false,
                code:"invalid_credentials",
                message:"Incorrect username or password. Please try again.",
            }
        }

        await clearExpiredLock(userata)

        const lockStatus=getLockStatus(userata)
        if(lockStatus.locked){
            return {
                success:false,
                code:"account_locked",
                message:lockStatus.message,
                lockedUntil:lockStatus.lockedUntil.toISOString(),
            }
        }

        const passwordcheck=await bcrypt.compare(password,userata.password||"")
        if(!passwordcheck){
            const failedAttempt=await registerFailedLoginAttempt(userata)

            return {
                success:false,
                code:failedAttempt.code,
                message:failedAttempt.message,
                remainingAttempts:failedAttempt.remainingAttempts,
                lockedUntil:failedAttempt.lockedUntil,
            }
        }

        userata.failedLoginAttempts=0
        userata.lockUntil=null
        userata.lastLoginAt=new Date()
        await userata.save()

        return {
            success:true,
            code:"success",
            message:"Login successful.",
            username:userata.username,
        }
    }
    catch{
        return {
            success:false,
            code:"server_error",
            message:"We could not complete your login right now. Please try again.",
        }
    }
}
