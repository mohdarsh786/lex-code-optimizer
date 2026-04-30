import {create} from 'zustand'
import { usrlist } from '@/types/user' 
import type { OptimizerResult } from '@/types/compiler'
type userregister={
    username:string,
    password:string,
    setusername:(value:string)=>void,
    setpassword:(value:string)=>void,
}
type userlogin={
    password:string,
    username:string,
    setusername:(value:string)=>void,
    setpassword:(value:string)=>void
}
type searchname={
    username:string,
    setusername:(value:string)=>void
}
type userlistttttt={
    users:usrlist[],
    message:string,
    setuser:(value:usrlist)=>void,
    setusrs:(value:usrlist[])=>void,
    setremoveuser:(value:usrlist)=>void,
    setmessage:(value:string)=>void
}
interface StoreState {
  value: boolean
  setvlue: (v: boolean) => void
  optimizerResult: OptimizerResult | null
  setOptimizerResult: (r: OptimizerResult | null) => void
}

export const Drawervalue = create<StoreState>((set) => ({
  value: false,
  setvlue: (v) => set({ value: v }),
  optimizerResult: null,
  setOptimizerResult: (r) => set({ optimizerResult: r }),
}))
export const Userregister=create<userregister>((set)=>({
    username:"",
    password:"",
    setusername:(value)=>set(({username:value})),
    setpassword:(value)=>set(({password:value})),
}))
export const Userlogin=create<userlogin>((set)=>({
    password:"",
    username:"",
    setusername:(value)=>set(({username:value})),
    setpassword:(value)=>set(({password:value}))
}))
export const Searchname=create<searchname>((set)=>({
    username:"",
    setusername:(value)=>set({username:value})
}))
export const Toklue=create<searchname>((set)=>({
    username:"",
    setusername:(value)=>set(({username:value}))
}))
export const Userlist=create<userlistttttt>((set)=>({
   users:[],
   message:"",
   setuser:(value)=>set((v)=>({users:[...v.users,value]})),
   setusrs:(value)=>set((v)=>({users:[...v.users,...value]})),
   setremoveuser:(value)=>set((v)=>({users:v.users.filter((valuee)=>valuee!==value)})),
   setmessage:(value)=>set(({message:value}))
}))
