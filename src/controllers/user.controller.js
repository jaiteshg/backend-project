import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiError} from '../utils/ApiError.js';
import {User} from "../models/user.model.js";
import {uplodeOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from 'mongoose';


const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
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
    const {accessToken , refreshToken } = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

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

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken 
    
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthenticated access token")
    }

try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invaild Access Token ")
        }
    
        if (incomingRefreshToken != user?.refreshToken) {
            throw new ApiError(401, "refresh token is used or expired") 
        }
    
        const options = {
            httpOnly : true,
            secure : true
        }
    
        const {accessToken , refreshToken : newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
         return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken :newRefreshToken}
            )    
        ) 
} catch (error) {
    throw new ApiError(401 , error?.message || "Invalid refresh token")
}   
})

const changeCurrentPassword = asyncHandler (async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
   .status(200)
   .json(new ApiResponse(200, {} , "Password changed successfully"))

})


const getCurrentUser = asyncHandler (async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})


const updateAccountDetails = asyncHandler (async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName,
                email: email
            }
        },
        {new: true}

    ).select("-password")

    return res
   .status(200)
   .json(new ApiResponse(200, user , "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req , res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }


    const avatar = await uplodeOnCloudinary (avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const avatarUpdate = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
   .status(200)
   .json(new ApiResponse(200, avatarUpdate , "Avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req , res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage is required")
    }


    const coverImage = await uplodeOnCloudinary (coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on coverImage")
    }

    const coverImageUpdate = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
   .status(200)
   .json(new ApiResponse(200, coverImageUpdate, "coverImage updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if(!username?.trim){
        throw new ApiError(400, "Username is required")
    }

    const channel = await User.aggregate([
        {
            $match : {
                username : username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "user",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribersTo"
            }
        },
        {
            $addFields:{
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribersToCount: {
                    $size: "$subscribersTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }

            }
        },
        {
            $project: {
                fullName: 1,
                username : 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelSubscribersToCount: 1,
                isSubscribed: 1,
                coverImage : 1,
                email: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(404, "Channel not found")
    }

    return res
   .status(200)
   .json(new ApiResponse(200, channel[0] , "Channel fetched successfully"))

})

const getWatchHistory = asyncHandler(async(req, res ) => {
    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.objectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username : 1,
                                        avatar: 1,
                                       
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $arrayElemAt: ["$owner", 0]
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistroy , "watch Histroy fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}