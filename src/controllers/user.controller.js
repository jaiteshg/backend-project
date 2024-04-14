import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiError} from '../utils/ApiError.js';
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req , res) => {
    // get user deatils from frontend
    // validation - not empty
    //check if user is already registered
    //check for images , check for avatar
    // upload them on cloudinary
    // create user object - create entry in db
    // remove password and refresh token token
    //check for user creation 
    // return respose


    const {fullName , email , username, password} = req.body 
    console.log("email: " , email);

    if(
       [fullName, email, username, password].some((field) => field?.trim() === "") 
    ){
        throw new ApiError(400, "ALl field are required")
    }

    User.findOne({
        $or : [{username} , {email}]
    })
    

    if (existedUSer){
        throw new ApiError(400, "User with email or username  already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    
    const coverImagePath = req.files?.coverImage[0]?.path;
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImagePath)
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName ,
        avatar: avatar.url ,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering")
    }

    return res.status (201).json(
        new ApiResponse(201, "User created successfully", createdUser)
    )


})

export {
    registerUser,
}