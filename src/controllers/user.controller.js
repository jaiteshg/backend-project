import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiError} from '../utils/ApiError.js';
import {User} from "../models/user.model.js";
import {uplodeOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js";


const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validBeforesave: false })

        return {
            accessToken,
            refreshToken
        }

    } catch (error) {
        throw new ApiError(500 , "something went wrong while generating access and refresh token");
    }
}

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


    const {fullName , email , username, password} = req.body;

    if(
       [fullName, email, username, password].some((field) => field?.trim() === "") 
    ){
        throw new ApiError(400, "ALl field are required")
    }

    const existedUSer = await User.findOne({
        $or : [{username} , {email}]
    })
    

    if (existedUSer){
        throw new ApiError(400, "User with email or username  already exists")
    }


    const avatarLocalPath = req.files?.avatar[0]?.path;
    
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    const avatar = await uplodeOnCloudinary(avatarLocalPath)
    const coverImage = await uplodeOnCloudinary(coverImageLocalPath)
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

const loginUser = asyncHandler(async (req , res) => {
    // take data from req body
    // usename or email
    // find the user
    // check if password is correct
    // acess and refresh  token
    //send cookie

    const {email, password , username} = req.body

    if(!username && !email) {
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or : [{username} , {email}]
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordVaild = await user.isPasswordCorrect(password)

    if (!isPasswordVaild) {
        throw new ApiError(401, "Password is incorrect")
    }
    const {accessToken , refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await user.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
            user : loggedInUser , accessToken , refreshToken
            },
            "User logged in successfully" 
        )
    )


})

const logOutUser = asyncHandler(async (req, res) => {
    
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {refreshToken: undefined}
           
        },
        { new: true }
    )
    
    const options = {
        httpOnly : true,
        secure : true
    }

    return res
   .status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(new ApiResponse(200, {} , "user logged out"))

})

export {
    registerUser,
    loginUser,
    logOutUser
}