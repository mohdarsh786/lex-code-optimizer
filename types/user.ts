export interface userrsignup{
    username:string,
    password:string,
}
export interface userrlogin{
    username:string,
    password:string
}
export interface usrlist{
    username:string,
    password?:string,
    createdAt?:Date|string
}
export type AuthActionCode=
    |"success"
    |"validation_error"
    |"invalid_credentials"
    |"account_locked"
    |"username_taken"
    |"server_error"

export interface AuthActionResult{
    success:boolean,
    code:AuthActionCode,
    message:string,
    username?:string,
    remainingAttempts?:number,
    lockedUntil?:string
}
